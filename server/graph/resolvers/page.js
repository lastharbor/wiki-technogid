const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async pages() { return {} }
  },
  Mutation: {
    async pages() { return {} }
  },
  PageQuery: {
    /**
     * PAGE HISTORY
     */
    async history(obj, args, context, info) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode', 'authorId', 'creatorId').findById(args.id)
      // Allow access if user has write:pages/read:history permission OR is the page author/creator
      const hasHistoryAccess = WIKI.auth.checkAccess(context.req.user, ['write:pages', 'read:history'], {
        path: page.path,
        locale: page.localeCode
      })
      const isAuthor = context.req.user && (context.req.user.id === page.authorId || context.req.user.id === page.creatorId)

      if (hasHistoryAccess || isAuthor) {
        return WIKI.models.pageHistory.getHistory({
          pageId: args.id,
          offsetPage: args.offsetPage || 0,
          offsetSize: args.offsetSize || 100
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },
    /**
     * PAGE VERSION
     */
    async version(obj, args, context, info) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return WIKI.models.pageHistory.getVersion({
          pageId: args.pageId,
          versionId: args.versionId
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },
    /**
     * SEARCH PAGES
     */
    async search (obj, args, context) {
      if (WIKI.data.searchEngine) {
        const resp = await WIKI.data.searchEngine.query(args.query, args)
        return {
          ...resp,
          results: _.filter(resp.results, r => {
            return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: r.path,
              locale: r.locale,
              tags: r.tags // Tags are needed since access permissions can be limited by page tags too
            })
          })
        }
      } else {
        return {
          results: [],
          suggestions: [],
          totalHits: 0
        }
      }
    },
    /**
     * LIST PAGES
     */
    async list (obj, args, context, info) {
      let results = await WIKI.models.pages.query().column([
        'pages.id',
        'path',
        { locale: 'localeCode' },
        'title',
        'description',
        'isPublished',
        'isPrivate',
        'privateNS',
        'contentType',
        'createdAt',
        'updatedAt',
        'pages.approvalStatus'
      ])
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
        .modify(queryBuilder => {
          if (args.limit) {
            queryBuilder.limit(args.limit)
          }
          if (args.locale) {
            queryBuilder.where('localeCode', args.locale)
          }
          if (args.creatorId && args.authorId && args.creatorId > 0 && args.authorId > 0) {
            queryBuilder.where(function () {
              this.where('creatorId', args.creatorId).orWhere('authorId', args.authorId)
            })
          } else {
            if (args.creatorId && args.creatorId > 0) {
              queryBuilder.where('creatorId', args.creatorId)
            }
            if (args.authorId && args.authorId > 0) {
              queryBuilder.where('authorId', args.authorId)
            }
          }
          if (args.tags && args.tags.length > 0) {
            queryBuilder.whereIn('tags.tag', args.tags.map(t => _.trim(t).toLowerCase()))
          }
          if (args.approvalStatus) {
            queryBuilder.where('pages.approvalStatus', args.approvalStatus.toLowerCase())
          }
          const orderDir = args.orderByDirection === 'DESC' ? 'desc' : 'asc'
          switch (args.orderBy) {
            case 'CREATED':
              queryBuilder.orderBy('createdAt', orderDir)
              break
            case 'PATH':
              queryBuilder.orderBy('path', orderDir)
              break
            case 'TITLE':
              queryBuilder.orderBy('title', orderDir)
              break
            case 'UPDATED':
              queryBuilder.orderBy('updatedAt', orderDir)
              break
            default:
              queryBuilder.orderBy('pages.id', orderDir)
              break
          }
        })
      results = _.filter(results, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).map(r => ({
        ...r,
        approvalStatus: (r.approvalStatus || 'approved').toUpperCase(),
        tags: _.map(r.tags, 'tag')
      }))
      if (args.tags && args.tags.length > 0) {
        results = _.filter(results, r => _.every(args.tags, t => _.includes(r.tags, t)))
      }
      return results
    },
    /**
     * FETCH SINGLE PAGE
     */
    async single (obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        // Allow access if user has write:pages permission OR is the page author/creator
        const hasWriteAccess = WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages', 'delete:pages'], {
          path: page.path,
          locale: page.localeCode
        })
        const isAuthor = context.req.user && (context.req.user.id === page.authorId || context.req.user.id === page.creatorId)

        if (hasWriteAccess || isAuthor) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey,
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    async singleByPath(obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb({
        path: args.path,
        locale: args.locale
      })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['manage:pages', 'delete:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey,
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    /**
     * FETCH TAGS
     */
    async tags (obj, args, context, info) {
      const pages = await WIKI.models.pages.query()
        .column([
          'path',
          { locale: 'localeCode' }
        ])
        .withGraphJoined('tags')
      const allTags = _.filter(pages, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).flatMap(r => r.tags)
      return _.orderBy(_.uniqBy(allTags, 'id'), ['tag'], ['asc'])
    },
    /**
     * SEARCH TAGS
     */
    async searchTags (obj, args, context, info) {
      const query = _.trim(args.query)
      const pages = await WIKI.models.pages.query()
        .column([
          'path',
          { locale: 'localeCode' }
        ])
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
        .modify(queryBuilder => {
          queryBuilder.andWhere(builderSub => {
            if (WIKI.config.db.type === 'postgres') {
              builderSub.where('tags.tag', 'ILIKE', `%${query}%`)
            } else {
              builderSub.where('tags.tag', 'LIKE', `%${query}%`)
            }
          })
        })
      const allTags = _.filter(pages, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).flatMap(r => r.tags).map(t => t.tag)
      return _.uniq(allTags).slice(0, 5)
    },
    /**
     * FETCH PAGE TREE
     */
    async tree (obj, args, context, info) {
      let curPage = null

      if (!args.locale) { args.locale = WIKI.config.lang.code }

      if (args.path && !args.parent) {
        curPage = await WIKI.models.knex('pageTree').first('parent', 'ancestors').where({
          path: args.path,
          localeCode: args.locale
        })
        if (curPage) {
          args.parent = curPage.parent || 0
        } else {
          return []
        }
      }

      const results = await WIKI.models.knex('pageTree').where(builder => {
        builder.where('localeCode', args.locale)
        switch (args.mode) {
          case 'FOLDERS':
            builder.andWhere('isFolder', true)
            break
          case 'PAGES':
            builder.andWhereNotNull('pageId')
            break
        }
        if (!args.parent || args.parent < 1) {
          builder.whereNull('parent')
        } else {
          builder.where('parent', args.parent)
          if (args.includeAncestors && curPage && curPage.ancestors.length > 0) {
            builder.orWhereIn('id', _.isString(curPage.ancestors) ? JSON.parse(curPage.ancestors) : curPage.ancestors)
          }
        }
      }).orderBy([{ column: 'isFolder', order: 'desc' }, 'title'])
      return results.filter(r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.localeCode
        })
      }).map(r => ({
        ...r,
        parent: r.parent || 0,
        locale: r.localeCode
      }))
    },
    /**
     * FETCH PAGE LINKS
     */
    async links (obj, args, context, info) {
      let results

      if (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb' || WIKI.config.db.type === 'sqlite') {
        results = await WIKI.models.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
          .leftJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.localeCode': args.locale
          })
          .unionAll(
            WIKI.models.knex('pageLinks')
              .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
              .leftJoin('pages', 'pageLinks.pageId', 'pages.id')
              .where({
                'pages.localeCode': args.locale
              })
          )
      } else {
        results = await WIKI.models.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
          .fullOuterJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({
            'pages.localeCode': args.locale
          })
      }

      return _.reduce(results, (result, val) => {
        // -> Check if user has access to source and linked page
        if (
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.path, locale: args.locale }) ||
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.link, locale: val.locale })
        ) {
          return result
        }

        const existingEntry = _.findIndex(result, ['id', val.id])
        if (existingEntry >= 0) {
          if (val.link) {
            result[existingEntry].links.push(`${val.locale}/${val.link}`)
          }
        } else {
          result.push({
            id: val.id,
            title: val.title,
            path: `${args.locale}/${val.path}`,
            links: val.link ? [`${val.locale}/${val.link}`] : []
          })
        }
        return result
      }, [])
    },
    /**
     * CHECK FOR EDITING CONFLICT
     */
    async checkConflicts (obj, args, context, info) {
      if (!args.id) {
        return false
      }

      const page = await WIKI.models.pages.query().select('path', 'localeCode', 'updatedAt').findById(args.id)
      if (!page) {
        return false
      }

      if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return page.updatedAt > args.checkoutDate
      }

      throw new WIKI.Error.PageUpdateForbidden()
    },
    /**
     * FETCH LATEST VERSION FOR CONFLICT COMPARISON
     */
    async conflictLatest (obj, args, context, info) {
      let page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            tags: page.tags.map(t => t.tag),
            locale: page.localeCode
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },
    async approvalQueue (obj, args, context) {
      const user = context.req.user || {}

      let query = WIKI.models.pages.query()
        .alias('pages')
        .leftJoin({ pending: 'pageHistory' }, 'pending.id', 'pages.pendingVersionId')
        .leftJoin({ submitter: 'users' }, 'submitter.id', 'pending.authorId')
        .select(
          'pages.id',
          'pages.path',
          { localeCode: 'pages.localeCode' },
          { currentTitle: 'pages.title' },
          { pendingTitle: 'pending.title' },
          { approvalStatus: 'pages.approvalStatus' },
          { updatedAt: 'pages.updatedAt' },
          { submittedAt: 'pending.versionDate' },
          { fallbackSubmittedAt: 'pending.createdAt' },
          { pendingVersionId: 'pages.pendingVersionId' },
          { submitterId: 'submitter.id' },
          { submitterName: 'submitter.name' },
          { submitterEmail: 'submitter.email' }
        )
        .orderBy('pages.updatedAt', 'desc')

      if (args && args.locale) {
        query = query.where('pages.localeCode', args.locale)
      }

      const hasStatusArg = args && Object.prototype.hasOwnProperty.call(args, 'status')
      const requestedStatus = hasStatusArg ?
        (_.isString(args.status) ? _.toLower(args.status) : '') :
        'pending'
      if (requestedStatus) {
        query = query.where('pages.approvalStatus', requestedStatus)
      }

      if (args && args.pathPrefix) {
        const prefix = _.trim(args.pathPrefix, '/')
        if (prefix.length > 0) {
          const escapedPrefix = prefix.replace(/[\\%_]/g, '\\$&')
          query = query.where('pages.path', 'like', `${escapedPrefix}%`)
        }
      }

      const rawResults = await query

      return rawResults.filter(row => {
        return WIKI.auth.checkAccess(user, ['approve:pages', 'manage:pages', 'manage:system'], {
          path: row.path,
          locale: row.localeCode
        })
      }).map(row => ({
        id: row.id,
        locale: row.localeCode,
        path: row.path,
        currentTitle: row.currentTitle,
        pendingTitle: row.pendingTitle || row.currentTitle,
        approvalStatus: (row.approvalStatus || 'approved').toUpperCase(),
        updatedAt: row.updatedAt,
        submittedAt: row.submittedAt || row.fallbackSubmittedAt || row.updatedAt,
        pendingVersionId: row.pendingVersionId,
        submitter: row.submitterId ? {
          id: row.submitterId,
          name: row.submitterName,
          email: row.submitterEmail
        } : null
      }))
    },
    async approvalDetail (obj, args, context) {
      const page = await WIKI.models.pages.getPageFromDb(args.id)
      if (!page) {
        throw new WIKI.Error.PageNotFound()
      }

      if (!WIKI.auth.checkAccess(context.req.user, ['approve:pages', 'manage:pages', 'manage:system'], {
        path: page.path,
        locale: page.localeCode
      })) {
        throw new WIKI.Error.PageViewForbidden()
      }

      const liveTags = page.tags ? page.tags.map(t => t.tag) : []
      let liveRender = page.render

      if (_.isEmpty(liveRender) && page.content) {
        try {
          liveRender = await WIKI.models.pages.renderPreview({
            content: page.content,
            contentType: page.contentType,
            pageContext: {
              id: page.id,
              path: page.path,
              localeCode: page.localeCode,
              title: page.title,
              description: page.description,
              tags: page.tags
            }
          })
        } catch (err) {
          WIKI.logger.warn('Failed to build live preview for approval detail', err)
          liveRender = page.render || ''
        }
      }

      let pendingVersion = null
      if (page.pendingVersionId) {
        const pending = await WIKI.models.pageHistory.query()
          .alias('ph')
          .leftJoin({ author: 'users' }, 'author.id', 'ph.authorId')
          .select(
            { versionId: 'ph.id' },
            'ph.title',
            'ph.description',
            'ph.content',
            'ph.contentType',
            'ph.editorKey',
            'ph.isPublished',
            'ph.isPrivate',
            'ph.publishStartDate',
            'ph.publishEndDate',
            'ph.createdAt',
            'ph.versionDate',
            'ph.extra',
            { authorId: 'author.id' },
            { authorName: 'author.name' },
            { authorEmail: 'author.email' }
          )
          .where('ph.id', page.pendingVersionId)
          .first()

        if (pending) {
          let pendingRender = ''
          let historyTags = []
          let pendingExtra = pending.extra || {}
          if (_.isString(pendingExtra)) {
            try {
              pendingExtra = JSON.parse(pendingExtra)
            } catch (err) {
              pendingExtra = {}
            }
          }

          try {
            historyTags = await WIKI.models.tags.getHistoryTags(pending.versionId)
          } catch (err) {
            WIKI.logger.warn('Failed to fetch history tags for pending version', err)
            historyTags = []
          }
          try {
            pendingRender = await WIKI.models.pages.renderPreview({
              content: pending.content,
              contentType: pending.contentType,
              pageContext: {
                id: page.id,
                path: page.path,
                localeCode: page.localeCode,
                title: pending.title,
                description: pending.description,
                tags: historyTags
              }
            })
          } catch (err) {
            WIKI.logger.warn('Failed to build pending preview for approval detail', err)
            pendingRender = pending.content || ''
          }

          pendingVersion = {
            versionId: pending.versionId,
            title: pending.title,
            description: pending.description,
            content: pending.content,
            contentType: pending.contentType,
            editor: pending.editorKey,
            tags: historyTags.map(t => t.tag),
            render: pendingRender,
            publishStartDate: pending.publishStartDate,
            publishEndDate: pending.publishEndDate,
            isPublished: pending.isPublished === true || pending.isPublished === 1,
            isPrivate: pending.isPrivate === true || pending.isPrivate === 1,
            createdAt: pending.versionDate || pending.createdAt,
            author: pending.authorId ? {
              id: pending.authorId,
              name: pending.authorName,
              email: pending.authorEmail
            } : null,
            approvalComment: _.get(pendingExtra, 'approvalComment', page.approvalComment || '')
          }
        }
      }

      const liveVersion = {
        versionId: null,
        title: page.title,
        description: page.description,
        content: page.content,
        contentType: page.contentType,
        editor: page.editorKey,
        tags: liveTags,
        render: liveRender,
        publishStartDate: page.publishStartDate,
        publishEndDate: page.publishEndDate,
        isPublished: !!page.isPublished,
        isPrivate: !!page.isPrivate,
        createdAt: page.createdAt,
        author: page.authorId ? {
          id: page.authorId,
          name: page.authorName,
          email: page.authorEmail
        } : null
      }

      return {
        id: page.id,
        locale: page.localeCode,
        path: page.path,
        approvalStatus: (page.approvalStatus || 'approved').toUpperCase(),
        approvalComment: page.approvalComment || '',
        isPublished: !!page.isPublished,
        currentIsPublished: !!page.isPublished,
        currentTitle: page.title,
        currentDescription: page.description,
        currentUpdatedAt: page.updatedAt,
        liveVersion,
        pendingVersion
      }
    }
  },
  PageMutation: {
    /**
     * CREATE PAGE
     */
    async create(obj, args, context) {
      try {
        const page = await WIKI.models.pages.createPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page created successfully.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE PAGE
     */
    async update(obj, args, context) {
      try {
        const page = await WIKI.models.pages.updatePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * CONVERT PAGE
     */
    async convert(obj, args, context) {
      try {
        await WIKI.models.pages.convertPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been converted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MOVE PAGE
     */
    async move(obj, args, context) {
      try {
        await WIKI.models.pages.movePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been moved.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async createFolder(obj, args, context) {
      try {
        const folder = await WIKI.models.pages.createFolder({
          user: context.req.user,
          ...args
        })
        return {
          responseResult: graphHelper.generateSuccess('Folder created successfully.'),
          folder: {
            locale: folder.localeCode,
            path: folder.path,
            title: folder.title
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteFolder(obj, args, context) {
      try {
        const folder = await WIKI.models.pages.deleteFolder({
          user: context.req.user,
          ...args
        })
        return {
          responseResult: graphHelper.generateSuccess('Folder deleted successfully.'),
          folder: {
            locale: folder.localeCode,
            path: folder.path,
            title: folder.title || ''
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE PAGE
     */
    async delete(obj, args, context) {
      try {
        await WIKI.models.pages.deletePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE TAG
     */
    async deleteTag (obj, args, context) {
      try {
        const tagToDel = await WIKI.models.tags.query().findById(args.id)
        if (tagToDel) {
          await tagToDel.$relatedQuery('pages').unrelate()
          await WIKI.models.tags.query().deleteById(args.id)
        } else {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess('Tag has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE TAG
     */
    async updateTag (obj, args, context) {
      try {
        const affectedRows = await WIKI.models.tags.query()
          .findById(args.id)
          .patch({
            tag: _.trim(args.tag).toLowerCase(),
            title: _.trim(args.title)
          })
        if (affectedRows < 1) {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess('Tag has been updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * FLUSH PAGE CACHE
     */
    async flushCache(obj, args, context) {
      try {
        await WIKI.models.pages.flushCache()
        WIKI.events.outbound.emit('flushCache')
        return {
          responseResult: graphHelper.generateSuccess('Pages Cache has been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * MIGRATE ALL PAGES FROM SOURCE LOCALE TO TARGET LOCALE
     */
    async migrateToLocale(obj, args, context) {
      try {
        const count = await WIKI.models.pages.migrateToLocale(args)
        return {
          responseResult: graphHelper.generateSuccess('Migrated content to target locale successfully.'),
          count
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * REBUILD TREE
     */
    async rebuildTree(obj, args, context) {
      try {
        await WIKI.models.pages.rebuildTree()
        return {
          responseResult: graphHelper.generateSuccess('Page tree rebuilt successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RENDER PAGE
     */
    async render (obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().findById(args.id)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }
        await WIKI.models.pages.renderPage(page)
        return {
          responseResult: graphHelper.generateSuccess('Page rendered successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async approve (obj, args, context) {
      try {
        const page = await WIKI.models.pages.approvePending({
          id: args.id,
          user: context.req.user,
          comment: args.comment || '',
          publish: typeof args.publish === 'boolean' ? args.publish : true
        })
        return {
          responseResult: graphHelper.generateSuccess('Pending changes approved.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async reject (obj, args, context) {
      try {
        const page = await WIKI.models.pages.rejectPending({
          id: args.id,
          user: context.req.user,
          comment: args.comment || ''
        })
        return {
          responseResult: graphHelper.generateSuccess('Pending changes rejected.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async cancelPending (obj, args, context) {
      try {
        const page = await WIKI.models.pages.cancelPending({
          id: args.id,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Pending changes cancelled.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * RESTORE PAGE VERSION
     */
    async restore (obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
        if (!page) {
          throw new WIKI.Error.PageNotFound()
        }

        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          throw new WIKI.Error.PageRestoreForbidden()
        }

        const targetVersion = await WIKI.models.pageHistory.getVersion({ pageId: args.pageId, versionId: args.versionId })
        if (!targetVersion) {
          throw new WIKI.Error.PageNotFound()
        }

        await WIKI.models.pages.updatePage({
          ...targetVersion,
          id: targetVersion.pageId,
          user: context.req.user,
          action: 'restored'
        })

        return {
          responseResult: graphHelper.generateSuccess('Page version restored successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Purge history
     */
    async purgeHistory (obj, args, context) {
      try {
        await WIKI.models.pageHistory.purge(args.olderThan)
        return {
          responseResult: graphHelper.generateSuccess('Page history purged successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  Page: {
    async tags (obj) {
      return WIKI.models.pages.relatedQuery('tags').for(obj.id)
    },
    locale (obj) {
      return obj.locale || obj.localeCode
    },
    scriptCss (obj) {
      let extra = obj.extra || {}
      if (_.isString(extra)) {
        try {
          extra = JSON.parse(extra)
        } catch (err) {
          extra = {}
        }
      }
      return _.get(extra, 'css', '')
    },
    scriptJs (obj) {
      let extra = obj.extra || {}
      if (_.isString(extra)) {
        try {
          extra = JSON.parse(extra)
        } catch (err) {
          extra = {}
        }
      }
      return _.get(extra, 'js', '')
    },
    approvalStatus (obj) {
      return (obj.approvalStatus || 'approved').toUpperCase()
    },
    async approverName (obj, args, context) {
      if (!obj.approverId) {
        return ''
      }
      if (obj.approverName) {
        return obj.approverName
      }
      const approver = await WIKI.models.users.query().findById(obj.approverId).select('name')
      return approver ? approver.name : ''
    },
    async approverEmail (obj, args, context) {
      if (!obj.approverId) {
        return ''
      }
      if (obj.approverEmail) {
        return obj.approverEmail
      }
      const approver = await WIKI.models.users.query().findById(obj.approverId).select('email')
      return approver ? approver.email : ''
    },
    async pendingVersion (obj, args, context) {
      if (!obj.pendingVersionId) {
        return null
      }
      const canViewPending = context.req.user && (WIKI.auth.checkAccess(context.req.user, ['approve:pages', 'manage:pages'], {
        locale: obj.locale,
        path: obj.path
      }) || context.req.user.id === obj.authorId)
      if (!canViewPending) {
        return null
      }
      return WIKI.models.pageHistory.getVersion({
        pageId: obj.id,
        versionId: obj.pendingVersionId
      })
    }
    // comments(pg) {
    //   return pg.$relatedQuery('comments')
    // }
  }
}
