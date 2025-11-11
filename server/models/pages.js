const Model = require('objection').Model
const _ = require('lodash')
const JSBinType = require('js-binary').Type
const pageHelper = require('../helpers/page')
const path = require('path')
const fs = require('fs-extra')
const yaml = require('js-yaml')
const striptags = require('striptags')
const emojiRegex = require('emoji-regex')
const he = require('he')
const CleanCSS = require('clean-css')
const TurndownService = require('turndown')
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm').gfm
const cheerio = require('cheerio')

/* global WIKI */

const frontmatterRegex = {
  html: /^(<!-{2}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{2}>)?(?:\n|\r)*([\w\W]*)*/,
  legacy: /^(<!-- TITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)?(<!-- SUBTITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)*([\w\W]*)*/i,
  markdown: /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?(?:\n|\r)*([\w\W]*)*/
}

const punctuationRegex = /[!,:;/\\_+\-=()&#@<>$~%^*[\]{}"'|]+|(\.\s)|(\s\.)/ig
// const htmlEntitiesRegex = /(&#[0-9]{3};)|(&#x[a-zA-Z0-9]{2};)/ig

/**
 * Pages model
 */
module.exports = class Page extends Model {
  static get tableName() { return 'pages' }

  static extractFrontmatter(rawContent = '', contentType = 'markdown') {
    if (!_.isString(rawContent) || _.isEmpty(rawContent)) {
      return {
        body: rawContent || '',
        data: null
      }
    }

    const normalizedType = _.toString(contentType).toLowerCase()
    if (!normalizedType.includes('markdown') && normalizedType !== 'md') {
      return {
        body: rawContent,
        data: null
      }
    }

    const frontmatterPattern = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/
    const match = rawContent.match(frontmatterPattern)
    if (!match) {
      return {
        body: rawContent,
        data: null
      }
    }

    let data = null
    try {
      data = yaml.safeLoad(match[1]) || {}
    } catch (err) {
      data = null
      if (typeof WIKI !== 'undefined' && _.get(WIKI, 'logger.warn')) {
        WIKI.logger.warn('Invalid YAML frontmatter detected while parsing content.', err)
      }
    }

    const body = rawContent.slice(match[0].length)
    return {
      body,
      data
    }
  }

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
        privateNS: {type: 'string'},
        publishStartDate: {type: 'string'},
        publishEndDate: {type: 'string'},
        content: {type: 'string'},
        contentType: {type: 'string'},
        approvalStatus: {type: 'string'},
        pendingVersionId: {type: ['integer', 'null']},
        approvalComment: {type: 'string'},
        approverId: {type: ['integer', 'null']},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['extra']
  }

  static get relationMappings() {
    return {
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./tags'),
        join: {
          from: 'pages.id',
          through: {
            from: 'pageTags.pageId',
            to: 'pageTags.tagId'
          },
          to: 'tags.id'
        }
      },
      links: {
        relation: Model.HasManyRelation,
        modelClass: require('./pageLinks'),
        join: {
          from: 'pages.id',
          to: 'pageLinks.pageId'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pages.authorId',
          to: 'users.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pages.creatorId',
          to: 'users.id'
        }
      },
      editor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'pages.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'pages.localeCode',
          to: 'locales.code'
        }
      },
      approver: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pages.approverId',
          to: 'users.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
  /**
   * Solving the violates foreign key constraint using cascade strategy
   * using static hooks
   * @see https://vincit.github.io/objection.js/api/types/#type-statichookarguments
   */
  static async beforeDelete({ asFindQuery }) {
    const page = await asFindQuery().select('id')
    await WIKI.models.comments.query().delete().where('pageId', page[0].id)
  }
  /**
   * Cache Schema
   */
  static get cacheSchema() {
    return new JSBinType({
      id: 'uint',
      authorId: 'uint',
      authorName: 'string',
      createdAt: 'string',
      creatorId: 'uint',
      creatorName: 'string',
      description: 'string',
      editorKey: 'string',
      isPrivate: 'boolean',
      isPublished: 'boolean',
      publishEndDate: 'string',
      publishStartDate: 'string',
      contentType: 'string',
      render: 'string',
      tags: [
        {
          tag: 'string',
          title: 'string'
        }
      ],
      extra: {
        js: 'string',
        css: 'string'
      },
      approvalStatus: 'string',
      title: 'string',
      toc: 'string',
      updatedAt: 'string'
    })
  }

  /**
   * Inject page metadata into contents
   *
   * @returns {string} Page Contents with Injected Metadata
   */
  injectMetadata () {
    return pageHelper.injectPageMetadata(this)
  }

  /**
   * Get the page's file extension based on content type
   *
   * @returns {string} File Extension
   */
  getFileExtension() {
    return pageHelper.getFileExtension(this.contentType)
  }

  /**
   * Parse injected page metadata from raw content
   *
   * @param {String} raw Raw file contents
   * @param {String} contentType Content Type
   * @returns {Object} Parsed Page Metadata with Raw Content
   */
  static parseMetadata (raw, contentType) {
    let result
    try {
      switch (contentType) {
        case 'markdown':
          result = frontmatterRegex.markdown.exec(raw)
          if (result[2]) {
            return {
              ...yaml.safeLoad(result[2]),
              content: result[3]
            }
          } else {
            // Attempt legacy v1 format
            result = frontmatterRegex.legacy.exec(raw)
            if (result[2]) {
              return {
                title: result[2],
                description: result[4],
                content: result[5]
              }
            }
          }
          break
        case 'html':
          result = frontmatterRegex.html.exec(raw)
          if (result[2]) {
            return {
              ...yaml.safeLoad(result[2]),
              content: result[3]
            }
          }
          break
      }
    } catch (err) {
      WIKI.logger.warn('Failed to parse page metadata. Invalid syntax.')
    }
    return {
      content: raw
    }
  }

  /**
   * Create a New Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async createPage(opts) {
    // -> Validate path
    if (opts.path.includes('.') || opts.path.includes(' ') || opts.path.includes('\\') || opts.path.includes('//')) {
      throw new WIKI.Error.PageIllegalPath()
    }

    // -> Remove trailing slash
    if (opts.path.endsWith('/')) {
      opts.path = opts.path.slice(0, -1)
    }

    // -> Remove starting slash
    if (opts.path.startsWith('/')) {
      opts.path = opts.path.slice(1)
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.locale,
      path: opts.path
    })) {
      throw new WIKI.Error.PageDeleteForbidden()
    }

    // -> Check for duplicate
    const dupCheck = await WIKI.models.pages.query().select('id').where('localeCode', opts.locale).where('path', opts.path).first()
    if (dupCheck) {
      throw new WIKI.Error.PageDuplicateCreate()
    }

    // -> Check for empty content
    if (!opts.content || _.trim(opts.content).length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    // -> Format CSS Scripts
    let scriptCss = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path
    })) {
      if (!_.isEmpty(opts.scriptCss)) {
        scriptCss = new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
      } else {
        scriptCss = ''
      }
    }

    // -> Format JS Scripts
    let scriptJs = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
      locale: opts.locale,
      path: opts.path
    })) {
      scriptJs = opts.scriptJs || ''
    }

    const canPublish = WIKI.auth.checkAccess(opts.user, ['publish:pages', 'approve:pages', 'manage:pages'], {
      locale: opts.locale,
      path: opts.path
    })
    const approvalStatus = canPublish ? 'approved' : 'pending'
    const newTags = Array.isArray(opts.tags) ? opts.tags : []

    // -> Create page
    await WIKI.models.pages.query().insert({
      authorId: opts.user.id,
      content: opts.content,
      creatorId: opts.user.id,
      contentType: _.get(_.find(WIKI.data.editors, ['key', opts.editor]), `contentType`, 'text'),
      description: opts.description,
      editorKey: opts.editor,
      hash: pageHelper.generateHash({ path: opts.path, locale: opts.locale, privateNS: opts.isPrivate ? 'TODO' : '' }),
      isPrivate: opts.isPrivate,
      isPublished: canPublish ? (opts.isPublished === true || opts.isPublished === 1) : false,
      localeCode: opts.locale,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      toc: '[]',
      extra: JSON.stringify({
        js: scriptJs,
        css: scriptCss
      }),
      approvalStatus,
      pendingVersionId: null,
      approvalComment: '',
      approverId: canPublish ? opts.user.id : null
    })
    const page = await WIKI.models.pages.getPageFromDb({
      path: opts.path,
      locale: opts.locale,
      userId: opts.user.id,
      isPrivate: opts.isPrivate
    })
    page.locale = page.localeCode
    page.editor = page.editorKey
    page.scriptJs = _.get(page.extra, 'js', '')
    page.scriptCss = _.get(page.extra, 'css', '')

    // -> Save Tags
    if (approvalStatus === 'approved') {
      if (newTags.length > 0) {
        await WIKI.models.tags.associateTags({ tags: newTags, page })
      }
    } else {
      let pageExtra = page.extra || {}
      if (_.isString(pageExtra)) {
        try {
          pageExtra = JSON.parse(pageExtra)
        } catch (err) {
          pageExtra = {}
        }
      }

      const pendingVersion = await WIKI.models.pageHistory.addVersion({
        ...page,
        authorId: opts.user.id,
        content: opts.content,
        description: opts.description,
        title: opts.title,
        publishStartDate: opts.publishStartDate || '',
        publishEndDate: opts.publishEndDate || '',
        editorKey: opts.editor,
        action: 'submitted',
        workflowStatus: 'pending',
        versionDate: new Date().toISOString(),
        tags: newTags,
        extra: {
          ...pageExtra,
          js: scriptJs,
          css: scriptCss
        }
      })

      await WIKI.models.pages.query().patch({
        pendingVersionId: pendingVersion.id,
        approvalStatus: 'pending',
        approvalComment: '',
        approverId: null
      }).where('id', page.id)

      page.pendingVersionId = pendingVersion.id
      page.approvalStatus = 'pending'
      page.approvalComment = ''
      page.approverId = null
      page.tags = newTags.map(tag => ({ tag, title: tag }))
    }

    // -> Render page to HTML
    await WIKI.models.pages.renderPage(page)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    if (approvalStatus === 'approved') {
      // -> Add to Search Index
      const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
      page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
      await WIKI.data.searchEngine.created(page)

      // -> Add to Storage
      if (!opts.skipStorage) {
        await WIKI.models.storage.pageEvent({
          event: 'created',
          page
        })
      }
    }

    // -> Reconnect Links
    await WIKI.models.pages.reconnectLinks({
      locale: page.localeCode,
      path: page.path,
      mode: 'create'
    })

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

    return page
  }

  /**
   * Update an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async updatePage(opts) {
    // -> Fetch original page
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }

    const hasWriteAccess = WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.localeCode,
      path: ogPage.path
    })

    const hasApprovalAccess = WIKI.auth.checkAccess(opts.user, ['approve:pages', 'manage:pages', 'manage:system'], {
      locale: ogPage.localeCode,
      path: ogPage.path
    })

    if (!hasWriteAccess && !(hasApprovalAccess && ogPage.pendingVersionId)) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check for empty content
    if (!opts.content || _.trim(opts.content).length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    const forcePending = opts.keepPending === true || opts.keepPending === 'true'

    const canApprove = WIKI.auth.checkAccess(opts.user, ['approve:pages', 'manage:pages'], {
      path: ogPage.path,
      locale: ogPage.localeCode
    })
    const canPublish = hasWriteAccess && WIKI.auth.checkAccess(opts.user, ['publish:pages', 'approve:pages', 'manage:pages'], {
      path: ogPage.path,
      locale: ogPage.localeCode
    })

    // -> Format Extra Properties
    if (!_.isPlainObject(ogPage.extra)) {
      try {
        ogPage.extra = JSON.parse(ogPage.extra || '{}')
      } catch (err) {
        ogPage.extra = {}
      }
    }

    // -> Format CSS Scripts
    let scriptCss = _.get(ogPage, 'extra.css', '')
    if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path
    })) {
      if (!_.isEmpty(opts.scriptCss)) {
        scriptCss = new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
      } else {
        scriptCss = ''
      }
    }

    // -> Format JS Scripts
    let scriptJs = _.get(ogPage, 'extra.js', '')
    if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
      locale: opts.locale,
      path: opts.path
    })) {
      scriptJs = opts.scriptJs || ''
    }

    const newContentType = _.get(_.find(WIKI.data.editors, ['key', opts.editor || ogPage.editorKey]), `contentType`, 'text')
    const newTags = Array.isArray(opts.tags) ? opts.tags : []

    if (!canPublish || forcePending) {
      let pendingVersionId = ogPage.pendingVersionId
      const pendingApprovalComment = Object.prototype.hasOwnProperty.call(opts, 'approvalComment')
        ? opts.approvalComment
        : ogPage.approvalComment
      const pendingExtra = {
        ...ogPage.extra,
        js: scriptJs,
        css: scriptCss,
        approvalComment: pendingApprovalComment || ''
      }
      const pendingData = {
        ...ogPage,
        content: opts.content,
        description: opts.description,
        title: opts.title,
        publishStartDate: opts.publishStartDate || '',
        publishEndDate: opts.publishEndDate || '',
        contentType: newContentType,
        editorKey: opts.editor || ogPage.editorKey,
        action: 'submitted',
        workflowStatus: 'pending',
        versionDate: new Date().toISOString(),
        authorId: opts.user.id,
        extra: pendingExtra,
        tags: newTags,
        approvalComment: pendingApprovalComment
      }

      if (pendingVersionId) {
        const serializedPendingExtra = WIKI.config.db.type === 'sqlite'
          ? JSON.stringify(pendingExtra)
          : pendingExtra
        await WIKI.models.pageHistory.query().patch({
          content: pendingData.content,
          description: pendingData.description,
          title: pendingData.title,
          publishStartDate: pendingData.publishStartDate,
          publishEndDate: pendingData.publishEndDate,
          contentType: pendingData.contentType,
          editorKey: pendingData.editorKey,
          authorId: pendingData.authorId,
          workflowStatus: 'pending',
          action: 'submitted',
          extra: serializedPendingExtra
        }).where('id', pendingVersionId)
        await WIKI.models.tags.associateHistoryTags({ tags: newTags, versionId: pendingVersionId })
      } else {
        const pendingVersion = await WIKI.models.pageHistory.addVersion({
          ...pendingData,
          extra: pendingData.extra
        })
        pendingVersionId = pendingVersion.id
      }

      await WIKI.models.pages.query().patch({
        approvalStatus: 'pending',
        pendingVersionId,
        approverId: null,
        approvalComment: pendingApprovalComment
      }).where('id', ogPage.id)

      const pagePending = await WIKI.models.pages.getPageFromDb(ogPage.id)
      pagePending.approvalStatus = 'pending'
      pagePending.pendingVersionId = pendingVersionId
      pagePending.locale = pagePending.localeCode
      pagePending.editor = pagePending.editorKey
      pagePending.scriptJs = _.get(pagePending.extra, 'js', '')
      pagePending.scriptCss = _.get(pagePending.extra, 'css', '')
      return pagePending
    }

    // -> Create version snapshot for approved update
    const currentTags = await ogPage.$relatedQuery('tags')
    await WIKI.models.pageHistory.addVersion({
      ...ogPage,
      isPublished: ogPage.isPublished === true || ogPage.isPublished === 1,
      action: opts.action ? opts.action : 'updated',
      versionDate: ogPage.updatedAt,
      tags: currentTags.map(t => t.tag),
      extra: ogPage.extra
    })

    // -> Update page (approved path)
    await WIKI.models.pages.query().patch({
      authorId: opts.user.id,
      content: opts.content,
      description: opts.description,
      isPublished: opts.isPublished === true || opts.isPublished === 1,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      approvalStatus: 'approved',
      pendingVersionId: null,
      approverId: canApprove ? opts.user.id : (canPublish ? opts.user.id : null),
      approvalComment: opts.approvalComment || '',
      editorKey: opts.editor || ogPage.editorKey,
      contentType: newContentType,
      extra: JSON.stringify({
        ...ogPage.extra,
        js: scriptJs,
        css: scriptCss
      })
    }).where('id', ogPage.id)

    if (ogPage.pendingVersionId) {
      await WIKI.models.pageHistory.query().patch({
        workflowStatus: 'approved',
        action: 'approved',
        versionDate: new Date().toISOString()
      }).where('id', ogPage.pendingVersionId)
    }

    let page = await WIKI.models.pages.getPageFromDb(ogPage.id)
    page.locale = page.localeCode
    page.editor = page.editorKey
    page.scriptJs = _.get(page.extra, 'js', '')
    page.scriptCss = _.get(page.extra, 'css', '')

    // -> Save Tags
    await WIKI.models.tags.associateTags({ tags: newTags, page })

    // -> Render page to HTML
    await WIKI.models.pages.renderPage(page)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update Search Index
    const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.updated(page)

    // -> Update on Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'updated',
        page
      })
    }

    // -> Perform move?
    if ((opts.locale && opts.locale !== page.localeCode) || (opts.path && opts.path !== page.path)) {
      // -> Check target path access
      if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
        locale: opts.locale,
        path: opts.path
      })) {
        throw new WIKI.Error.PageMoveForbidden()
      }

      await WIKI.models.pages.movePage({
        id: page.id,
        destinationLocale: opts.locale,
        destinationPath: opts.path,
        user: opts.user
      })
    } else {
      // -> Update title of page tree entry
      await WIKI.models.knex.table('pageTree').where({
        pageId: page.id
      }).update('title', page.title)
    }

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

    return page
  }

  static async approvePending({ id, user, comment = '', publish = true }) {
    const page = await WIKI.models.pages.query().findById(id)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    if (!WIKI.auth.checkAccess(user, ['approve:pages', 'manage:pages'], {
      locale: page.localeCode,
      path: page.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    let pendingVersion = null
    let historyTags = []

    if (page.pendingVersionId) {
      pendingVersion = await WIKI.models.pageHistory.query()
        .select([
          'pageHistory.id',
          'pageHistory.content',
          'pageHistory.contentType',
          'pageHistory.description',
          'pageHistory.editorKey',
          'pageHistory.publishEndDate',
          'pageHistory.publishStartDate',
          'pageHistory.title',
          'pageHistory.authorId',
          'pageHistory.extra'
        ])
        .where('pageHistory.id', page.pendingVersionId)
        .first()

      if (!pendingVersion) {
        await WIKI.models.pages.query().patch({
          approvalStatus: 'approved',
          pendingVersionId: null
        }).where('id', id)
        throw new Error('Pending version content was not found.')
      }

      historyTags = await WIKI.models.tags.getHistoryTags(pendingVersion.id)
    } else {
      let existingExtra = page.extra || {}
      if (_.isString(existingExtra)) {
        try {
          existingExtra = JSON.parse(existingExtra)
        } catch (err) {
          existingExtra = {}
        }
      }

      pendingVersion = {
        id: null,
        content: page.content,
        contentType: page.contentType,
        description: page.description,
        editorKey: page.editorKey,
        publishEndDate: page.publishEndDate,
        publishStartDate: page.publishStartDate,
        title: page.title,
        authorId: page.authorId,
        extra: existingExtra
      }

      historyTags = await WIKI.models.knex('pageTags')
        .join('tags', 'pageTags.tagId', 'tags.id')
        .where('pageTags.pageId', page.id)
        .select('tags.tag')
        .then(rows => rows.map(r => r.tag))
    }

    let pendingExtra = pendingVersion.extra
    if (_.isString(pendingExtra)) {
      try {
        pendingExtra = JSON.parse(pendingExtra)
      } catch (err) {
        pendingExtra = {}
      }
    }
    const pendingHistoryExtra = {
      ...pendingExtra,
      approvalComment: comment || ''
    }

    let currentExtra
    if (_.isString(page.extra)) {
      try {
        currentExtra = JSON.parse(page.extra || '{}')
      } catch (err) {
        currentExtra = {}
      }
    } else {
      currentExtra = page.extra || {}
    }

    const mergedExtra = {
      ...currentExtra,
      ...pendingExtra
    }

    const currentPublished = page.isPublished === true || page.isPublished === 1 || page.isPublished === '1'

    await WIKI.models.pages.query().patch({
      content: pendingVersion.content,
      description: pendingVersion.description,
      contentType: pendingVersion.contentType,
      editorKey: pendingVersion.editorKey,
      publishStartDate: pendingVersion.publishStartDate || '',
      publishEndDate: pendingVersion.publishEndDate || '',
      title: pendingVersion.title,
      authorId: pendingVersion.authorId || page.authorId,
      isPublished: publish ? true : currentPublished,
      approvalStatus: 'approved',
      pendingVersionId: null,
      approvalComment: comment,
      approverId: user.id,
      extra: JSON.stringify(mergedExtra)
    }).where('id', id)

    if (pendingVersion.id) {
      const serializedPendingExtra = WIKI.config.db.type === 'sqlite'
        ? JSON.stringify(pendingHistoryExtra)
        : pendingHistoryExtra
      await WIKI.models.pageHistory.query().patch({
        workflowStatus: 'approved',
        action: 'approved',
        versionDate: new Date().toISOString(),
        extra: serializedPendingExtra
      }).where('id', pendingVersion.id)
    }

    // Fetch as Objection model instance to support $relatedQuery
    const updatedPageModel = await WIKI.models.pages.query().findById(id)

    const updatedPageRaw = await WIKI.models.pages.getPageFromDb(id)

    let updatedExtra = updatedPageRaw.extra || {}
    if (_.isString(updatedExtra)) {
      try {
        updatedExtra = JSON.parse(updatedExtra)
      } catch (err) {
        updatedExtra = {}
      }
    }

    const updatedPage = {
      ...updatedPageRaw,
      locale: updatedPageRaw.localeCode,
      editor: updatedPageRaw.editorKey,
      scriptJs: _.get(updatedExtra, 'js', ''),
      scriptCss: _.get(updatedExtra, 'css', ''),
      isPublished: updatedPageRaw.isPublished === true || updatedPageRaw.isPublished === 1,
      isPrivate: updatedPageRaw.isPrivate === true || updatedPageRaw.isPrivate === 1,
      extra: updatedExtra
    }

    const historyTagValues = Array.isArray(historyTags) ? historyTags.map(t => t.tag || t) : []
    await WIKI.models.tags.associateTags({ tags: historyTagValues, page: updatedPageModel })

    await WIKI.models.pages.renderPage(updatedPage)
    WIKI.events.outbound.emit('deletePageFromCache', updatedPage.hash)

    const pageContents = await WIKI.models.pages.query().findById(updatedPage.id).select('render')
    updatedPage.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.updated(updatedPage)

    await WIKI.models.storage.pageEvent({
      event: 'updated',
      page: updatedPage
    })

    return updatedPage
  }

  static async rejectPending({ id, user, comment = '' }) {
    const page = await WIKI.models.pages.query().findById(id)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    if (!WIKI.auth.checkAccess(user, ['approve:pages', 'manage:pages'], {
      locale: page.localeCode,
      path: page.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    if (!page.pendingVersionId) {
      throw new Error('No pending version to reject for this page.')
    }

    const pendingVersion = await WIKI.models.pageHistory.query()
      .select(['pageHistory.id', 'pageHistory.extra'])
      .where('pageHistory.id', page.pendingVersionId)
      .first()

    let pendingExtra = _.get(pendingVersion, 'extra', {})
    if (_.isString(pendingExtra)) {
      try {
        pendingExtra = JSON.parse(pendingExtra)
      } catch (err) {
        pendingExtra = {}
      }
    }
    pendingExtra = {
      ...pendingExtra,
      approvalComment: comment || ''
    }

    await WIKI.models.pages.query().patch({
      approvalStatus: 'rejected',
      pendingVersionId: null,
      approvalComment: comment,
      approverId: user.id
    }).where('id', id)

    const serializedPendingExtra = WIKI.config.db.type === 'sqlite'
      ? JSON.stringify(pendingExtra)
      : pendingExtra

    await WIKI.models.pageHistory.query().patch({
      workflowStatus: 'rejected',
      action: 'rejected',
      versionDate: new Date().toISOString(),
      extra: serializedPendingExtra
    }).where('id', page.pendingVersionId)

    const updatedPage = await WIKI.models.pages.getPageFromDb(id)
    updatedPage.locale = updatedPage.localeCode
    updatedPage.editor = updatedPage.editorKey
    updatedPage.scriptJs = _.get(updatedPage.extra, 'js', '')
    updatedPage.scriptCss = _.get(updatedPage.extra, 'css', '')

    return updatedPage
  }

  static async cancelPending({ id, user }) {
    const page = await WIKI.models.pages.query().findById(id)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    if (!page.pendingVersionId) {
      return WIKI.models.pages.getPageFromDb(id)
    }

    if (page.authorId !== user.id && !WIKI.auth.checkAccess(user, ['manage:pages'], {
      locale: page.localeCode,
      path: page.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    const pendingVersion = await WIKI.models.pageHistory.query()
      .select(['pageHistory.id', 'pageHistory.extra'])
      .where('pageHistory.id', page.pendingVersionId)
      .first()

    let pendingExtra = _.get(pendingVersion, 'extra', {})
    if (_.isString(pendingExtra)) {
      try {
        pendingExtra = JSON.parse(pendingExtra)
      } catch (err) {
        pendingExtra = {}
      }
    }
    pendingExtra = {
      ...pendingExtra,
      approvalComment: ''
    }

    await WIKI.models.pages.query().patch({
      approvalStatus: 'draft',
      pendingVersionId: null,
      approvalComment: '',
      approverId: null
    }).where('id', id)

    const serializedPendingExtra = WIKI.config.db.type === 'sqlite'
      ? JSON.stringify(pendingExtra)
      : pendingExtra

    await WIKI.models.pageHistory.query().patch({
      workflowStatus: 'cancelled',
      action: 'cancelled',
      versionDate: new Date().toISOString(),
      extra: serializedPendingExtra
    }).where('id', page.pendingVersionId)

    const updatedPage = await WIKI.models.pages.getPageFromDb(id)
    updatedPage.locale = updatedPage.localeCode
    updatedPage.editor = updatedPage.editorKey
    updatedPage.scriptJs = _.get(updatedPage.extra, 'js', '')
    updatedPage.scriptCss = _.get(updatedPage.extra, 'css', '')

    return updatedPage
  }

  /**
   * Convert an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async convertPage(opts) {
    // -> Fetch original page
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }

    if (ogPage.editorKey === opts.editor) {
      throw new Error('Page is already using this editor. Nothing to convert.')
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.localeCode,
      path: ogPage.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check content type
    const sourceContentType = ogPage.contentType
    const targetContentType = _.get(_.find(WIKI.data.editors, ['key', opts.editor]), `contentType`, 'text')
    const shouldConvert = sourceContentType !== targetContentType
    let convertedContent = null

    // -> Convert content
    if (shouldConvert) {
      // -> Markdown => HTML
      if (sourceContentType === 'markdown' && targetContentType === 'html') {
        if (!ogPage.render) {
          throw new Error('Aborted conversion because rendered page content is empty!')
        }
        convertedContent = ogPage.render

        const $ = cheerio.load(convertedContent, {
          decodeEntities: true
        })

        if ($.root().children().length > 0) {
          // Remove header anchors
          $('.toc-anchor').remove()

          // Attempt to convert tabsets
          $('tabset').each((tabI, tabElm) => {
            const tabHeaders = []
            // -> Extract templates
            $(tabElm).children('template').each((tmplI, tmplElm) => {
              if ($(tmplElm).attr('v-slot:tabs') === '') {
                $(tabElm).before('<ul class="tabset-headers">' + $(tmplElm).html() + '</ul>')
              } else {
                $(tabElm).after('<div class="markdown-tabset">' + $(tmplElm).html() + '</div>')
              }
            })
            // -> Parse tab headers
            $(tabElm).prev('.tabset-headers').children((i, elm) => {
              tabHeaders.push($(elm).html())
            })
            $(tabElm).prev('.tabset-headers').remove()
            // -> Inject tab headers
            $(tabElm).next('.markdown-tabset').children((i, elm) => {
              if (tabHeaders.length > i) {
                $(elm).prepend(`<h2>${tabHeaders[i]}</h2>`)
              }
            })
            $(tabElm).next('.markdown-tabset').prepend('<h1>Tabset</h1>')
            $(tabElm).remove()
          })

          convertedContent = $.html('body').replace('<body>', '').replace('</body>', '').replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
            code = parseInt(code, 16)

            // Don't unescape ASCII characters, assuming they're encoded for a good reason
            if (code < 0x80) return entity

            return String.fromCodePoint(code)
          })
        }

      // -> HTML => Markdown
      } else if (sourceContentType === 'html' && targetContentType === 'markdown') {
        const td = new TurndownService({
          bulletListMarker: '-',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
          fence: '```',
          headingStyle: 'atx',
          hr: '---',
          linkStyle: 'inlined',
          preformattedCode: true,
          strongDelimiter: '**'
        })

        td.use(turndownPluginGfm)

        td.keep(['kbd'])

        td.addRule('subscript', {
          filter: ['sub'],
          replacement: c => `~${c}~`
        })

        td.addRule('superscript', {
          filter: ['sup'],
          replacement: c => `^${c}^`
        })

        td.addRule('underline', {
          filter: ['u'],
          replacement: c => `_${c}_`
        })

        td.addRule('taskList', {
          filter: (n, o) => {
            return n.nodeName === 'INPUT' && n.getAttribute('type') === 'checkbox'
          },
          replacement: (c, n) => {
            return n.getAttribute('checked') ? '[x] ' : '[ ] '
          }
        })

        td.addRule('removeTocAnchors', {
          filter: (n, o) => {
            return n.nodeName === 'A' && n.classList.contains('toc-anchor')
          },
          replacement: c => ''
        })

        convertedContent = td.turndown(ogPage.content)
      // -> Unsupported
      } else {
        throw new Error('Unsupported source / destination content types combination.')
      }
    }

    // -> Create version snapshot
    if (shouldConvert) {
      await WIKI.models.pageHistory.addVersion({
        ...ogPage,
        isPublished: ogPage.isPublished === true || ogPage.isPublished === 1,
        action: 'updated',
        versionDate: ogPage.updatedAt
      })
    }

    // -> Update page
    await WIKI.models.pages.query().patch({
      contentType: targetContentType,
      editorKey: opts.editor,
      ...(convertedContent ? { content: convertedContent } : {})
    }).where('id', ogPage.id)
    const page = await WIKI.models.pages.getPageFromDb(ogPage.id)

    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update on Storage
    await WIKI.models.storage.pageEvent({
      event: 'updated',
      page
    })
  }

  /**
   * Move a Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise with no value
   */
  static async movePage(opts) {
    let page
    if (_.has(opts, 'id')) {
      page = await WIKI.models.pages.query().findById(opts.id)
    } else {
      page = await WIKI.models.pages.query().findOne({
        path: opts.path,
        localeCode: opts.locale
      })
    }
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Validate path
    if (opts.destinationPath.includes('.') || opts.destinationPath.includes(' ') || opts.destinationPath.includes('\\') || opts.destinationPath.includes('//')) {
      throw new WIKI.Error.PageIllegalPath()
    }

    // -> Remove trailing slash
    if (opts.destinationPath.endsWith('/')) {
      opts.destinationPath = opts.destinationPath.slice(0, -1)
    }

    // -> Remove starting slash
    if (opts.destinationPath.startsWith('/')) {
      opts.destinationPath = opts.destinationPath.slice(1)
    }

    // -> Check for source page access
    if (!WIKI.auth.checkAccess(opts.user, ['manage:pages'], {
      locale: page.localeCode,
      path: page.path
    })) {
      throw new WIKI.Error.PageMoveForbidden()
    }
    // -> Check for destination page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.destinationLocale,
      path: opts.destinationPath
    })) {
      throw new WIKI.Error.PageMoveForbidden()
    }

    // -> Check for existing page at destination path
    const destPage = await WIKI.models.pages.query().findOne({
      path: opts.destinationPath,
      localeCode: opts.destinationLocale
    })
    if (destPage) {
      throw new WIKI.Error.PagePathCollision()
    }

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...page,
      action: 'moved',
      versionDate: page.updatedAt
    })

    const destinationHash = pageHelper.generateHash({ path: opts.destinationPath, locale: opts.destinationLocale, privateNS: opts.isPrivate ? 'TODO' : '' })

    // -> Move page
    const destinationTitle = (page.title === _.last(page.path.split('/')) ? _.last(opts.destinationPath.split('/')) : page.title)
    await WIKI.models.pages.query().patch({
      path: opts.destinationPath,
      localeCode: opts.destinationLocale,
      title: destinationTitle,
      hash: destinationHash
    }).findById(page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    // -> Rename in Search Index
    const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.renamed({
      ...page,
      destinationPath: opts.destinationPath,
      destinationLocaleCode: opts.destinationLocale,
      title: destinationTitle,
      destinationHash
    })

    // -> Rename in Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'renamed',
        page: {
          ...page,
          destinationPath: opts.destinationPath,
          destinationLocaleCode: opts.destinationLocale,
          destinationHash,
          moveAuthorId: opts.user.id,
          moveAuthorName: opts.user.name,
          moveAuthorEmail: opts.user.email
        }
      })
    }

    // -> Reconnect Links : Changing old links to the new path
    await WIKI.models.pages.reconnectLinks({
      sourceLocale: page.localeCode,
      sourcePath: page.path,
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'move'
    })

    // -> Reconnect Links : Validate invalid links to the new path
    await WIKI.models.pages.reconnectLinks({
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'create'
    })
  }

  /**
   * Delete an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise with no value
   */
  static async deletePage(opts) {
    const page = await WIKI.models.pages.getPageFromDb(_.has(opts, 'id') ? opts.id : opts)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['delete:pages'], {
      locale: page.locale,
      path: page.path
    })) {
      throw new WIKI.Error.PageDeleteForbidden()
    }

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...page,
      action: 'deleted',
      versionDate: page.updatedAt
    })

    // -> Delete page
    await WIKI.models.pages.query().delete().where('id', page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    // -> Delete from Search Index
    await WIKI.data.searchEngine.deleted(page)

    // -> Delete from Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'deleted',
        page
      })
    }

    // -> Reconnect Links
    await WIKI.models.pages.reconnectLinks({
      locale: page.localeCode,
      path: page.path,
      mode: 'delete'
    })
  }

  /**
   * Reconnect links to new/move/deleted page
   *
   * @param {Object} opts - Page parameters
   * @param {string} opts.path - Page Path
   * @param {string} opts.locale - Page Locale Code
   * @param {string} [opts.sourcePath] - Previous Page Path (move only)
   * @param {string} [opts.sourceLocale] - Previous Page Locale Code (move only)
   * @param {string} opts.mode - Page Update mode (create, move, delete)
   * @returns {Promise} Promise with no value
   */
  static async reconnectLinks (opts) {
    const pageHref = `/${opts.locale}/${opts.path}`
    let replaceArgs = {
      from: '',
      to: ''
    }
    switch (opts.mode) {
      case 'create':
        replaceArgs.from = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        break
      case 'move':
        const prevPageHref = `/${opts.sourceLocale}/${opts.sourcePath}`
        replaceArgs.from = `<a href="${prevPageHref}" class="is-internal-link is-valid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        break
      case 'delete':
        replaceArgs.from = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        break
      default:
        return false
    }

    let affectedHashes = []
    // -> Perform replace and return affected page hashes (POSTGRES only)
    if (WIKI.config.db.type === 'postgres') {
      const qryHashes = await WIKI.models.pages.query()
        .returning('hash')
        .patch({
          render: WIKI.models.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    } else {
      // -> Perform replace, then query affected page hashes (MYSQL, MARIADB, MSSQL, SQLITE only)
      await WIKI.models.pages.query()
        .patch({
          render: WIKI.models.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      const qryHashes = await WIKI.models.pages.query()
        .column('hash')
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    }
    for (const hash of affectedHashes) {
      await WIKI.models.pages.deletePageFromCache(hash)
      WIKI.events.outbound.emit('deletePageFromCache', hash)
    }
  }

  /**
   * Rebuild page tree for new/updated/deleted page
   *
   * @returns {Promise} Promise with no value
   */
  static async rebuildTree() {
    const rebuildJob = await WIKI.scheduler.registerJob({
      name: 'rebuild-tree',
      immediate: true,
      worker: true
    })
    return rebuildJob.finished
  }

  static async renderPreview({ content, contentType, pageContext = {} }) {
    const normalizedContentType = contentType || _.get(pageContext, 'contentType', 'markdown')
    await WIKI.models.renderers.fetchDefinitions()
    const pipeline = await WIKI.models.renderers.getRenderingPipeline(normalizedContentType)
    const { body: preparedContent, data: frontmatterData } = Page.extractFrontmatter(content || '', normalizedContentType)

    const toPlainObject = (modelInstance) => {
      if (!modelInstance) {
        return {}
      }
      if (typeof modelInstance.toJSON === 'function') {
        return modelInstance.toJSON()
      }
      if (typeof modelInstance === 'object') {
        return _.cloneDeep(modelInstance)
      }
      return {}
    }

    const createStubQuery = (rows = []) => {
      const data = Array.isArray(rows) ? rows : []
      const promise = Promise.resolve(data)
      const noop = () => promise
      promise.select = noop
      promise.where = noop
      promise.whereIn = noop
      promise.orderBy = noop
      promise.limit = noop
      promise.clone = noop
      promise.modify = noop
      promise.withGraphFetched = noop
      promise.first = () => Promise.resolve(data.length > 0 ? data[0] : null)
      promise.context = noop
      promise.throwIfNotFound = noop
      return promise
    }

    let dbPage = null
    if (pageContext && pageContext.id) {
      try {
        dbPage = await WIKI.models.pages.query().findById(pageContext.id)
      } catch (err) {
        WIKI.logger.debug('renderPreview: unable to fetch page model', err)
      }
    }

    const pageForRenderer = {
      ...toPlainObject(dbPage),
      ...(_.isPlainObject(pageContext) ? pageContext : {}),
      id: _.get(pageContext, 'id', _.get(dbPage, 'id', null)),
      isPreview: true
    }

    pageForRenderer.$relatedQuery = (relationName) => {
      switch (relationName) {
        case 'tags':
          return createStubQuery(_.get(pageContext, 'tags', _.get(pageForRenderer, 'tags', [])))
        case 'links':
          return createStubQuery([])
        default:
          return createStubQuery([])
      }
    }

    pageForRenderer.content = preparedContent
    pageForRenderer.contentType = normalizedContentType
    if (frontmatterData) {
      pageForRenderer.frontmatter = frontmatterData
      if (!pageForRenderer.title && _.isString(frontmatterData.title)) {
        pageForRenderer.title = frontmatterData.title
      }
      if (!pageForRenderer.description && _.isString(frontmatterData.description)) {
        pageForRenderer.description = frontmatterData.description
      }
      if (!pageForRenderer.tags && (Array.isArray(frontmatterData.tags) || _.isString(frontmatterData.tags))) {
        pageForRenderer.tags = Array.isArray(frontmatterData.tags) ? frontmatterData.tags : _.split(frontmatterData.tags, ',').map(tag => _.trim(tag)).filter(Boolean)
      }
    }

    for (const core of pipeline) {
      const renderer = require(`../modules/rendering/${_.kebabCase(core.key)}/renderer.js`)
      const renderResult = await renderer.render.call({
        config: core.config,
        children: core.children,
        page: pageForRenderer,
        input: pageForRenderer.content
      })
      pageForRenderer.content = renderResult
      pageForRenderer.render = renderResult
    }

    return pageForRenderer.render || ''
  }

  /**
   * Trigger the rendering of a page
   *
   * @param {Object} page Page Model Instance
   * @returns {Promise} Promise with no value
   */
  static async renderPage(page) {
    const renderJob = await WIKI.scheduler.registerJob({
      name: 'render-page',
      immediate: true,
      worker: true
    }, page.id)
    return renderJob.finished
  }

  /**
   * Fetch an Existing Page from Cache if possible, from DB otherwise and save render to Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPage(opts) {
    // -> Get from cache first
    let page = await WIKI.models.pages.getPageFromCache(opts)
    if (!page) {
      // -> Get from DB
      page = await WIKI.models.pages.getPageFromDb(opts)
      if (page) {
        if (page.render) {
          // -> Save render to cache
          await WIKI.models.pages.savePageToCache(page)
        } else {
          // -> No render? Last page render failed...
          throw new Error('Page has no rendered version. Looks like the Last page render failed. Try to edit the page and save it again.')
        }
      }
    }
    return page
  }

  /**
   * Fetch an Existing Page from the Database
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromDb(opts) {
    const queryModeID = _.isNumber(opts)
    try {
      return WIKI.models.pages.query()
        .column([
          'pages.id',
          'pages.path',
          'pages.hash',
          'pages.title',
          'pages.description',
          'pages.isPrivate',
          'pages.isPublished',
          'pages.privateNS',
          'pages.publishStartDate',
          'pages.publishEndDate',
          'pages.content',
          'pages.render',
          'pages.toc',
          'pages.contentType',
          'pages.createdAt',
          'pages.updatedAt',
          'pages.editorKey',
          'pages.localeCode',
          'pages.authorId',
          'pages.creatorId',
          'pages.extra',
          'pages.approvalStatus',
          'pages.pendingVersionId',
          'pages.approvalComment',
          'pages.approverId',
          {
            authorName: 'author.name',
            authorEmail: 'author.email',
            creatorName: 'creator.name',
            creatorEmail: 'creator.email',
            approverName: 'approver.name',
            approverEmail: 'approver.email'
          }
        ])
        .joinRelated('author')
        .joinRelated('creator')
        .leftJoinRelated('approver')
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag', 'title')
        })
        .where(queryModeID ? {
          'pages.id': opts
        } : {
          'pages.path': opts.path,
          'pages.localeCode': opts.locale
        })
        // .andWhere(builder => {
        //   if (queryModeID) return
        //   builder.where({
        //     'pages.isPublished': true
        //   }).orWhere({
        //     'pages.isPublished': false,
        //     'pages.authorId': opts.userId
        //   })
        // })
        // .andWhere(builder => {
        //   if (queryModeID) return
        //   if (opts.isPrivate) {
        //     builder.where({ 'pages.isPrivate': true, 'pages.privateNS': opts.privateNS })
        //   } else {
        //     builder.where({ 'pages.isPrivate': false })
        //   }
        // })
        .first()
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  /**
   * Save a Page Model Instance to Cache
   *
   * @param {Object} page Page Model Instance
   * @returns {Promise} Promise with no value
   */
  static async savePageToCache(page) {
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${page.hash}.bin`)
    await fs.outputFile(cachePath, WIKI.models.pages.cacheSchema.encode({
      id: page.id,
      authorId: page.authorId,
      authorName: page.authorName,
      createdAt: page.createdAt,
      creatorId: page.creatorId,
      creatorName: page.creatorName,
      description: page.description,
      editorKey: page.editorKey,
      extra: {
        css: _.get(page, 'extra.css', ''),
        js: _.get(page, 'extra.js', '')
      },
      isPrivate: page.isPrivate === 1 || page.isPrivate === true,
      isPublished: page.isPublished === 1 || page.isPublished === true,
      publishEndDate: page.publishEndDate,
      publishStartDate: page.publishStartDate,
      contentType: page.contentType,
      render: page.render,
      tags: (page.tags || []).map(t => _.pick(t, ['tag', 'title'])),
      approvalStatus: page.approvalStatus || 'approved',
      title: page.title,
      toc: _.isString(page.toc) ? page.toc : JSON.stringify(page.toc),
      updatedAt: page.updatedAt
    }))
  }

  /**
   * Fetch an Existing Page from Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromCache(opts) {
    const pageHash = pageHelper.generateHash({ path: opts.path, locale: opts.locale, privateNS: opts.isPrivate ? 'TODO' : '' })
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${pageHash}.bin`)

    try {
      const pageBuffer = await fs.readFile(cachePath)
      let page = WIKI.models.pages.cacheSchema.decode(pageBuffer)
      return {
        ...page,
        path: opts.path,
        localeCode: opts.locale,
        isPrivate: opts.isPrivate
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false
      }
      WIKI.logger.error(err)
      throw err
    }
  }

  /**
   * Delete an Existing Page from Cache
   *
   * @param {String} page Page Unique Hash
   * @returns {Promise} Promise with no value
   */
  static async deletePageFromCache(hash) {
    return fs.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${hash}.bin`))
  }

  /**
   * Flush the contents of the Cache
   */
  static async flushCache() {
    return fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache`))
  }

  static async createFolder({ user, locale, path: folderPath, title }) {
    const localeCode = _.trim((locale || '').toLowerCase())
    let cleanPath = _.trim(folderPath || '', '/')

    if (!localeCode || !cleanPath) {
      throw new Error('Folder locale and path are required.')
    }

    cleanPath = cleanPath.replace(/\\/g, '/').split('/').filter(Boolean).join('/')
    if (!cleanPath) {
      throw new WIKI.Error.PageIllegalPath()
    }

    if (!WIKI.auth.checkAccess(user, ['manage:pages'], {
      locale: localeCode,
      path: cleanPath
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    const segments = cleanPath.split('/')
    for (const segment of segments) {
      if (!segment || segment.includes('.') || segment.includes(' ') || segment.includes('\\') || segment.includes('//')) {
        throw new WIKI.Error.PageIllegalPath()
      }
    }

    const pageConflict = await WIKI.models.pages.query()
      .where({ localeCode, path: cleanPath })
      .first()
    if (pageConflict) {
      throw new Error('A page already exists at this path.')
    }

    const folderConflict = await WIKI.models.knex('pageFolders')
      .where({ localeCode, path: cleanPath })
      .first()
    if (folderConflict) {
      throw new Error('Folder already exists.')
    }

    const folderTitle = _.trim(title) || _.startCase(_.last(segments))
    const folderData = {
      localeCode,
      path: cleanPath,
      title: folderTitle
    }

    let insertedId
    if (WIKI.config.db.type === 'sqlite') {
      const resp = await WIKI.models.knex('pageFolders').insert(folderData)
      insertedId = Array.isArray(resp) ? resp[0] : resp
    } else {
      const resp = await WIKI.models.knex('pageFolders').insert(folderData, ['id'])
      insertedId = Array.isArray(resp) ? _.get(resp, '[0].id', null) : resp
    }

    await WIKI.models.pages.rebuildTree()

    return WIKI.models.knex('pageFolders')
      .where({ id: insertedId })
      .first()
  }

  static async deleteFolder({ user, locale, path: folderPath }) {
    const localeCode = _.trim((locale || '').toLowerCase())
    const cleanPath = _.trim(folderPath || '', '/')

    if (!localeCode || !cleanPath) {
      throw new Error('Folder locale and path are required.')
    }

    if (!WIKI.auth.checkAccess(user, ['manage:pages'], {
      locale: localeCode,
      path: cleanPath
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    const folder = await WIKI.models.knex('pageFolders')
      .where({ localeCode, path: cleanPath })
      .first()
    if (!folder) {
      throw new Error('Folder not found.')
    }

    const hasPages = await WIKI.models.pages.query()
      .where('localeCode', localeCode)
      .andWhere('path', 'like', `${cleanPath}/%`)
      .first()
    if (hasPages) {
      throw new Error('Folder is not empty.')
    }

    const hasSubFolders = await WIKI.models.knex('pageFolders')
      .where('localeCode', localeCode)
      .andWhere('path', 'like', `${cleanPath}/%`)
      .first()
    if (hasSubFolders) {
      throw new Error('Folder contains subfolders.')
    }

    const removedFolder = {
      localeCode,
      path: cleanPath,
      title: folder.title
    }

    await WIKI.models.knex('pageFolders')
      .where({ id: folder.id })
      .delete()

    await WIKI.models.pages.rebuildTree()

    return removedFolder
  }

  /**
   * Migrate all pages from a source locale to the target locale
   *
   * @param {Object} opts Migration properties
   * @param {string} opts.sourceLocale Source Locale Code
   * @param {string} opts.targetLocale Target Locale Code
   * @returns {Promise} Promise with no value
   */
  static async migrateToLocale({ sourceLocale, targetLocale }) {
    return WIKI.models.pages.query()
      .patch({
        localeCode: targetLocale
      })
      .where({
        localeCode: sourceLocale
      })
      .whereNotExists(function() {
        this.select('id').from('pages AS pagesm').where('pagesm.localeCode', targetLocale).andWhereRaw('pagesm.path = pages.path')
      })
  }

  /**
   * Clean raw HTML from content for use in search engines
   *
   * @param {string} rawHTML Raw HTML
   * @returns {string} Cleaned Content Text
   */
  static cleanHTML(rawHTML = '') {
    let data = striptags(rawHTML || '', [], ' ')
      .replace(emojiRegex(), '')
      // .replace(htmlEntitiesRegex, '')
    return he.decode(data)
      .replace(punctuationRegex, ' ')
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s\s+/g, ' ')
      .split(' ').filter(w => w.length > 1).join(' ').toLowerCase()
  }

  /**
   * Subscribe to HA propagation events
   */
  static subscribeToEvents() {
    WIKI.events.inbound.on('deletePageFromCache', hash => {
      WIKI.models.pages.deletePageFromCache(hash)
    })
    WIKI.events.inbound.on('flushCache', () => {
      WIKI.models.pages.flushCache()
    })
  }
}
