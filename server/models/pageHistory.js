const Model = require('objection').Model
const _ = require('lodash')
const { DateTime, Duration } = require('luxon')

/* global WIKI */

/**
 * Page History model
 */
module.exports = class PageHistory extends Model {
  static get tableName() { return 'pageHistory' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: {type: 'integer'},
        path: {type: 'string'},
        hash: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        isPublished: {type: 'boolean'},
        publishStartDate: {type: 'string'},
        publishEndDate: {type: 'string'},
        content: {type: 'string'},
        contentType: {type: 'string'},
        workflowStatus: {type: 'string'},
        sourceVersionId: {type: ['integer', 'null']},
        extra: {type: ['object', 'string', 'null']},

        createdAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./tags'),
        join: {
          from: 'pageHistory.id',
          through: {
            from: 'pageHistoryTags.pageId',
            to: 'pageHistoryTags.tagId'
          },
          to: 'tags.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageHistory.pageId',
          to: 'pages.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageHistory.authorId',
          to: 'users.id'
        }
      },
      editor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'pageHistory.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'pageHistory.localeCode',
          to: 'locales.code'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
  }

  /**
   * Create Page Version
   */
  static async addVersion(opts) {
    let extraData = opts.extra || {}
    if (_.isString(extraData)) {
      try {
        extraData = JSON.parse(extraData)
      } catch (err) {
        extraData = {}
      }
    }
    extraData = _.cloneDeep(extraData)

    if (Object.prototype.hasOwnProperty.call(opts, 'approvalComment')) {
      extraData.approvalComment = opts.approvalComment
    }

    if (WIKI.config.db.type === 'sqlite') {
      extraData = JSON.stringify(extraData)
    }

    const version = await WIKI.models.pageHistory.query().insert({
      pageId: opts.id,
      authorId: opts.authorId,
      content: opts.content,
      contentType: opts.contentType,
      description: opts.description,
      editorKey: opts.editorKey,
      hash: opts.hash,
      isPrivate: (opts.isPrivate === true || opts.isPrivate === 1),
      isPublished: (opts.isPublished === true || opts.isPublished === 1),
      localeCode: opts.localeCode,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      action: opts.action || 'updated',
      versionDate: opts.versionDate,
      workflowStatus: opts.workflowStatus || 'history',
      sourceVersionId: opts.sourceVersionId || null,
      extra: extraData
    })
    if (opts.tags && opts.tags.length > 0) {
      await WIKI.models.tags.associateHistoryTags({ tags: opts.tags, versionId: version.id })
    }
    return version
  }

  /**
   * Get Page Version
   */
  static async getVersion({ pageId, versionId }) {
    const version = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.path',
        'pageHistory.title',
        'pageHistory.description',
        'pageHistory.isPrivate',
        'pageHistory.isPublished',
        'pageHistory.publishStartDate',
        'pageHistory.publishEndDate',
        'pageHistory.content',
        'pageHistory.contentType',
        'pageHistory.createdAt',
        'pageHistory.action',
        'pageHistory.authorId',
        'pageHistory.pageId',
        'pageHistory.workflowStatus',
        'pageHistory.extra',
        'pageHistory.versionDate',
        {
          versionId: 'pageHistory.id',
          editor: 'pageHistory.editorKey',
          locale: 'pageHistory.localeCode',
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.id': versionId,
        'pageHistory.pageId': pageId
      }).first()
    if (version) {
      if (typeof version.extra === 'string') {
        try {
          version.extra = JSON.parse(version.extra)
        } catch (err) {
          version.extra = null
        }
      }
      const versionTags = await WIKI.models.tags.getHistoryTags(versionId)
      const approvalComment = _.get(version.extra, 'approvalComment', '')
      return {
        ...version,
        updatedAt: version.createdAt || null,
        tags: versionTags.map(t => t.tag),
        scriptCss: _.get(version.extra, 'css', ''),
        scriptJs: _.get(version.extra, 'js', ''),
        workflowStatus: (version.workflowStatus || 'history').toUpperCase(),
        approvalComment: _.isString(approvalComment) ? approvalComment : ''
      }
    } else {
      return null
    }
  }

  /**
   * Get History Trail of a Page
   */
  static async getHistory({ pageId, offsetPage = 0, offsetSize = 100 }) {
    const history = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.id',
        'pageHistory.path',
        'pageHistory.authorId',
        'pageHistory.action',
        'pageHistory.versionDate',
        'pageHistory.workflowStatus',
        'pageHistory.extra',
        {
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.pageId': pageId
      })
      .orderBy('pageHistory.versionDate', 'desc')
      .page(offsetPage, offsetSize)

    let prevPh = null
    const upperLimit = (offsetPage + 1) * offsetSize

    if (history.total >= upperLimit) {
      prevPh = await WIKI.models.pageHistory.query()
        .column([
          'pageHistory.id',
          'pageHistory.path',
          'pageHistory.authorId',
          'pageHistory.action',
          'pageHistory.versionDate',
          'pageHistory.workflowStatus',
          'pageHistory.extra',
          {
            authorName: 'author.name'
          }
        ])
        .joinRelated('author')
        .where({
          'pageHistory.pageId': pageId
        })
        .orderBy('pageHistory.versionDate', 'desc')
        .offset((offsetPage + 1) * offsetSize)
        .limit(1)
        .first()
    }

    return {
      trail: _.reduce(_.reverse(history.results), (res, ph) => {
        let actionType = 'edit'
        let valueBefore = null
        let valueAfter = null

        if (!prevPh && history.total < upperLimit) {
          actionType = 'initial'
        } else if (_.get(prevPh, 'path', '') !== ph.path) {
          actionType = 'move'
          valueBefore = _.get(prevPh, 'path', '')
          valueAfter = ph.path
        }

        let extra = ph.extra || {}
        if (_.isString(extra)) {
          try {
            extra = JSON.parse(extra)
          } catch (err) {
            extra = {}
          }
        }

        const approvalComment = _.get(extra, 'approvalComment', '')
        const approvalCommentValue = _.isString(approvalComment) ? _.trim(approvalComment) : ''
        const workflowStatus = _.get(ph, 'workflowStatus', '')

        res.unshift({
          versionId: ph.id,
          authorId: ph.authorId,
          authorName: ph.authorName,
          actionType,
          valueBefore,
          valueAfter,
          versionDate: ph.versionDate,
          workflowStatus: workflowStatus ? workflowStatus.toUpperCase() : '',
          approvalComment: approvalCommentValue
        })

        prevPh = ph
        return res
      }, []),
      total: history.total
    }
  }

  /**
   * Purge history older than X
   *
   * @param {String} olderThan ISO 8601 Duration
   */
  static async purge (olderThan) {
    const dur = Duration.fromISO(olderThan)
    const olderThanISO = DateTime.utc().minus(dur)
    await WIKI.models.pageHistory.query().where('versionDate', '<', olderThanISO.toISO()).del()
  }
}
