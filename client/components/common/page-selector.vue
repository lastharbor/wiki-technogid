<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='850px'
    overlay-color='blue darken-4'
    overlay-opacity='.7'
    )
    v-card.page-selector
      .dialog-header.is-blue
        v-icon.mr-3(color='white') mdi-page-next-outline
        .body-1(v-if='mode === `create`') {{$t('common:pageSelector.createTitle')}}
        .body-1(v-else-if='mode === `move`') {{$t('common:pageSelector.moveTitle')}}
        .body-1(v-else-if='mode === `select`') {{$t('common:pageSelector.selectTitle')}}
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      .d-flex
        v-flex.grey(xs5, :class='$vuetify.theme.dark ? `darken-4` : `lighten-3`')
          v-toolbar(color='grey darken-3', dark, dense, flat)
            .body-2 {{$t('common:pageSelector.virtualFolders')}}
            v-spacer
            v-btn(icon, tile, v-if='canManageFolders', @click='openNewFolderDialog', :aria-label="$t('common:actions.create')")
              v-icon mdi-folder-plus
            v-btn(icon, tile, v-if='canManageFolders && currentFolderPath', @click='promptDeleteFolder', :aria-label="$t('common:actions.delete')")
              v-icon mdi-folder-remove
            v-btn(icon, tile, href='https://docs.requarks.io/guide/pages#folders', target='_blank')
              v-icon mdi-help-box
          div(style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              v-treeview(
                :key='`pageTree-` + treeViewCacheId'
                :active.sync='currentNode'
                :open.sync='openNodes'
                :items='tree'
                :load-children='fetchFolders'
                dense
                expand-icon='mdi-menu-down-outline'
                item-id='path'
                item-text='title'
                activatable
                hoverable
                )
                template(slot='prepend', slot-scope='{ item, open, leaf }')
                  v-icon mdi-{{ open ? 'folder-open' : 'folder' }}
        v-flex(xs7)
          v-toolbar(color='blue darken-2', dark, dense, flat)
            .body-2 {{$t('common:pageSelector.pages')}}
            //- v-spacer
            //- v-btn(icon, tile, disabled): v-icon mdi-content-save-move-outline
            //- v-btn(icon, tile, disabled): v-icon mdi-trash-can-outline
          div(v-if='currentPages.length > 0', style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              v-list.py-0(dense)
                v-list-item-group(
                  v-model='currentPage'
                  color='primary'
                  )
                  template(v-for='(page, idx) of currentPages')
                    v-list-item(:key='`page-` + page.id', :value='page')
                      v-list-item-icon: v-icon mdi-text-box
                      v-list-item-title {{page.title}}
                    v-divider(v-if='idx < pages.length - 1')
          v-alert.animated.fadeIn(
            v-else
            text
            color='orange'
            prominent
            icon='mdi-alert'
            )
            .body-2 {{$t('common:pageSelector.folderEmptyWarning')}}
      v-card-actions.grey.pa-2(:class='$vuetify.theme.dark ? `darken-2` : `lighten-1`', v-if='!mustExist')
        v-select(
          solo
          dark
          flat
          background-color='grey darken-3-d2'
          hide-details
          single-line
          :items='namespaces'
          style='flex: 0 0 100px; border-radius: 4px 0 0 4px;'
          v-model='currentLocale'
          )
        v-text-field(
          ref='pathIpt'
          solo
          hide-details
          prefix='/'
          v-model='currentPath'
          flat
          clearable
          style='border-radius: 0 4px 4px 0;'
        )
      v-card-chin
        v-spacer
        v-btn(text, @click='close') {{$t('common:actions.cancel')}}
        v-btn.px-4(color='primary', @click='open', :disabled='!isValidPath')
          v-icon(left) mdi-check
          span {{$t('common:actions.select')}}
    v-dialog(v-model='newFolderDialog', max-width='420')
      v-card.page-selector-new-folder
        .dialog-header.is-blue
          v-icon.mr-2(color='white') mdi-folder-plus
          span.white--text {{$t('editor:assets.newFolder')}}
        v-card-text.pb-0.pt-6.px-6
          v-text-field(
            outlined
            autofocus
            :label='$t(`editor:assets.folderName`)'
            v-model='newFolderName'
            :disabled='newFolderLoading'
          )
        v-card-chin
          v-spacer
          v-btn(text, @click='newFolderDialog = false', :disabled='newFolderLoading') {{$t('common:actions.cancel')}}
          v-btn(color='primary', :loading='newFolderLoading', @click='createFolderConfirm').white--text {{$t('common:actions.create')}}
    v-dialog(v-model='deleteFolderDialog', max-width='420')
      v-card
        .dialog-header.is-red
          v-icon.mr-2(color='white') mdi-folder-remove
          span.white--text Delete Folder
        v-card-text.pt-5
          .body-2.grey--text.text--darken-2 Are you sure you want to delete this folder?
          .caption.grey--text {{ currentFolderPath }}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteFolderDialog = false') {{$t('common:actions.cancel')}}
          v-btn(color='red darken-2', dark, @click='deleteFolderConfirm') {{$t('common:actions.delete')}}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

import createFolderMutation from 'gql/admin/pages/pages-mutation-folder-create.gql'
import deleteFolderMutation from 'gql/admin/pages/pages-mutation-folder-delete.gql'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i

/* global siteLangs, siteConfig */

export default {
  i18nOptions: { namespaces: ['common', 'editor'] },
  props: {
    value: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      default: 'new-page'
    },
    locale: {
      type: String,
      default: 'en'
    },
    mode: {
      type: String,
      default: 'create'
    },
    openHandler: {
      type: Function,
      default: () => {}
    },
    mustExist: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      treeViewCacheId: 0,
      searchLoading: false,
      currentLocale: siteConfig.lang,
      currentPath: 'new-page',
      currentPage: null,
      currentNode: [0],
      openNodes: [0],
      tree: [
        {
          id: 0,
          title: '/ (root)',
          children: []
        }
      ],
      pages: [],
      all: [],
      namespaces: siteLangs.length ? siteLangs.map(ns => ns.code) : [siteConfig.lang],
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#999',
          hoverStyle: {
            background: '#64B5F6'
          }
        }
      },
      newFolderDialog: false,
      newFolderName: '',
      newFolderLoading: false,
      deleteFolderDialog: false
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    currentPages () {
      return _.sortBy(_.filter(this.pages, ['parent', _.head(this.currentNode) || 0]), ['title', 'path'])
    },
    isValidPath () {
      if (!this.currentPath) {
        return false
      }
      if (this.mustExist && !this.currentPage) {
        return false
      }
      const firstSection = _.head(this.currentPath.split('/'))
      if (firstSection.length <= 1) {
        return false
      } else if (localeSegmentRegex.test(firstSection)) {
        return false
      } else if (
        _.some(['login', 'logout', 'register', 'verify', 'favicons', 'fonts', 'img', 'js', 'svg'], p => {
          return p === firstSection
        })) {
        return false
      } else {
        return true
      }
    },
    currentFolder() {
      if (!this.currentNode || this.currentNode.length < 1) {
        return null
      }
      return _.find(this.all, ['id', this.currentNode[0]]) || null
    },
    currentFolderPath() {
      const folder = this.currentFolder
      return folder && folder.path ? folder.path : ''
    },
    canManageFolders() {
      try {
        const perms = this.$store.get('user/permissions') || []
        return _.includes(perms, 'manage:pages') || _.includes(perms, 'manage:system')
      } catch (err) {
        return false
      }
    }
  },
  watch: {
    isShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.currentPath = this.path
        this.currentLocale = this.locale
        _.delay(() => {
          this.$refs.pathIpt.focus()
        })
      }
    },
    currentNode (newValue, oldValue) {
      if (newValue.length < 1) { // force a selection
        this.$nextTick(() => {
          this.currentNode = oldValue
        })
      } else {
        const current = _.find(this.all, ['id', newValue[0]])

        if (this.openNodes.indexOf(newValue[0]) < 0) { // auto open and load children
          if (current) {
            if (this.openNodes.indexOf(current.parent) < 0) {
              this.$nextTick(() => {
                this.openNodes.push(current.parent)
              })
            }
          }
          this.$nextTick(() => {
            this.openNodes.push(newValue[0])
          })
        }

        this.currentPath = _.compact([_.get(current, 'path', ''), _.last(this.currentPath.split('/'))]).join('/')
      }
    },
    currentPage (newValue, oldValue) {
      if (!_.isEmpty(newValue)) {
        this.currentPath = newValue.path
      }
    },
    currentLocale (newValue, oldValue) {
      this.$nextTick(() => {
        this.tree = [
          {
            id: 0,
            title: '/ (root)',
            children: []
          }
        ]
        this.currentNode = [0]
        this.openNodes = [0]
        this.pages = []
        this.all = []
        this.treeViewCacheId += 1
      })
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    open() {
      const exit = this.openHandler({
        locale: this.currentLocale,
        path: this.currentPath,
        id: (this.mustExist && this.currentPage) ? this.currentPage.pageId : 0
      })
      if (exit !== false) {
        this.close()
      }
    },
    openNewFolderDialog() {
      this.newFolderName = ''
      this.newFolderDialog = true
    },
    promptDeleteFolder() {
      this.deleteFolderDialog = true
    },
    folderSlug(name) {
      return _.kebabCase(_.trim(name || ''))
    },
    async reloadTree(targetPath = null) {
      this.tree = [
        {
          id: 0,
          title: '/ (root)',
          children: []
        }
      ]
      this.currentNode = [0]
      this.openNodes = [0]
      this.pages = []
      this.all = []
      this.treeViewCacheId += 1
      await this.$nextTick()
      await this.fetchFolders(this.tree[0])
      if (targetPath) {
        await this.expandToPath(targetPath)
      }
    },
    async expandToPath(path) {
      if (!path) { return }
      const segments = path.split('/')
      let parentId = 0
      let currentPath = ''
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        let node = _.find(this.all, ['path', currentPath])
        if (!node) {
          const parentNode = parentId === 0 ? this.tree[0] : _.find(this.all, ['id', parentId])
          if (parentNode) {
            await this.fetchFolders(parentNode)
            node = _.find(this.all, ['path', currentPath])
          }
        }
        if (node) {
          if (!_.includes(this.openNodes, node.id)) {
            this.openNodes.push(node.id)
          }
          parentId = node.id
        } else {
          break
        }
      }
      const targetNode = _.find(this.all, ['path', path])
      if (targetNode) {
        this.currentNode = [targetNode.id]
      }
    },
    async createFolderConfirm() {
      if (this.newFolderLoading) { return }
      const name = _.trim(this.newFolderName)
      if (!name) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: this.$t ? this.$t('common:validation.required') : 'Folder name is required.',
          icon: 'alert'
        })
        return
      }
      const slug = this.folderSlug(name)
      if (!slug) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Invalid folder name.',
          icon: 'alert'
        })
        return
      }
      const basePath = this.currentFolderPath
      const targetPath = basePath ? `${basePath}/${slug}` : slug
      this.newFolderLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: createFolderMutation,
          variables: {
            locale: this.currentLocale,
            path: targetPath,
            title: name
          }
        })
        const result = _.get(resp, 'data.pages.createFolder', {})
        if (_.get(result, 'responseResult.succeeded')) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: result.responseResult.message || 'Folder created successfully.',
            icon: 'folder'
          })
          this.newFolderDialog = false
          this.newFolderName = ''
          await this.reloadTree(targetPath)
        } else {
          throw new Error(_.get(result, 'responseResult.message', 'Unable to create folder.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: err.message,
          icon: 'alert'
        })
      } finally {
        this.newFolderLoading = false
      }
    },
    async deleteFolderConfirm() {
      if (!this.currentFolderPath || this.currentFolderPath.length < 1) {
        this.deleteFolderDialog = false
        return
      }
      try {
        const resp = await this.$apollo.mutate({
          mutation: deleteFolderMutation,
          variables: {
            locale: this.currentLocale,
            path: this.currentFolderPath
          }
        })
        const result = _.get(resp, 'data.pages.deleteFolder', {})
        if (_.get(result, 'responseResult.succeeded')) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: result.responseResult.message || 'Folder deleted successfully.',
            icon: 'check'
          })
          this.deleteFolderDialog = false
          await this.reloadTree()
        } else {
          throw new Error(_.get(result, 'responseResult.message', 'Unable to delete folder.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'error',
          message: err.message,
          icon: 'alert'
        })
      }
    },
    async fetchFolders (item) {
      this.searchLoading = true
      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int!, $mode: PageTreeMode!, $locale: String!) {
            pages {
              tree(parent: $parent, mode: $mode, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
        variables: {
          parent: item.id,
          mode: 'ALL',
          locale: this.currentLocale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const itemFolders = _.filter(items, ['isFolder', true]).map(f => ({...f, children: []}))
      const itemPages = _.filter(items, i => i.pageId > 0)
      if (itemFolders.length > 0) {
        item.children = itemFolders
      } else {
        item.children = undefined
      }
      this.pages = _.unionBy(this.pages, itemPages, 'id')
      this.all = _.unionBy(this.all, items, 'id')

      this.searchLoading = false
    }
  }
}
</script>

<style lang='scss'>

.page-selector {
  .v-treeview-node__label {
    font-size: 13px;
  }
  .v-treeview-node__content {
    cursor: pointer;
  }
}

.page-selector-new-folder {
  .dialog-header {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }

  .v-card-text {
    padding-bottom: 0 !important;
  }

  .v-card__actions {
    padding: 0 24px 16px;
  }
}

</style>
