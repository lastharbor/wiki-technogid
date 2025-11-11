<template lang="pug">
  v-app.editor(:dark='$vuetify.theme.dark')
    nav-header(dense)
      template(slot='actions')
        v-btn.animated.fadeInDown(
          text
          :color='saveButtonColor'
          @click.exact='save'
          @click.ctrl.exact='saveAndClose'
          icon
          )
          v-icon(:color='saveButtonColor') {{ saveButtonIcon }}
        v-btn.animated.fadeInDown.wait-p1s(
          text
          color='blue'
          @click='openPropsModal'
          icon
          )
          v-icon(color='blue') mdi-file-cog-outline
        v-btn.animated.fadeInDown.wait-p1s(
          v-if='!welcomeMode'
          text
          color='amber darken-2'
          @click='openReviewerComments'
          icon
          )
          v-icon(color='amber darken-2') mdi-comment-account-outline
        v-btn.mr-2.animated.fadeIn(color='amber', outlined, small, v-if='isConflict', @click='openConflict')
          .overline.amber--text.mr-2 Conflict
          status-indicator(intermediary, pulse)
        v-btn.animated.fadeInDown.wait-p2s(
          v-if='!welcomeMode'
          text
          color='red'
          icon
          @click='exit'
          )
          v-icon(color='red') mdi-close
        v-divider.ml-3(vertical)
    v-main
      component(:is='currentEditor', :save='save', :open-reviewer-comments='openReviewerComments')
      editor-modal-properties(v-model='dialogProps')
      editor-modal-editorselect(v-model='dialogEditorSelector')
      editor-modal-unsaved(v-model='dialogUnsaved', @discard='exitGo')
      component(:is='activeModal')

    v-dialog(v-model='dialogReviewerComments', max-width='520')
      v-card
        v-card-title.py-3
          v-icon.mr-2(color='amber darken-2') mdi-comment-account-outline
          span.font-weight-medium Reviewer Notes
        v-divider
        v-card-text.py-4
          v-skeleton-loader(type='list-item-three-line', v-if='reviewerCommentsLoading')
          v-alert(type='info', outlined, v-else-if='!reviewerComments.length')
            span No reviewer notes are available yet.
          v-list.two-line(dense, v-else)
            v-list-item(
              v-for='note in reviewerComments'
              :key='note.versionId'
              class='reviewer-note-item'
            )
              v-list-item-content
                v-list-item-title
                  span.font-weight-medium {{ note.statusLabel }}
                  span.caption.ml-2.grey--text {{ note.versionDate | moment('LLL') }}
                v-list-item-subtitle
                  span {{ note.comment }}
              v-list-item-action
                v-chip(small, label, :color='note.chipColor', dark) {{ note.status }}
        v-card-actions
          v-spacer
          v-btn(text, color='grey', @click='dialogReviewerComments = false') Close

    loader(v-model='dialogProgress', :title='$t(`editor:save.processing`)', :subtitle='$t(`editor:save.pleaseWait`)')
    notify
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get, sync } from 'vuex-pathify'
import { AtomSpinner } from 'epic-spinners'
import { Base64 } from 'js-base64'
import { StatusIndicator } from 'vue-status-indicator'

import editorStore from '../store/editor'

/* global WIKI */

WIKI.$store.registerModule('editor', editorStore)

export default {
  i18nOptions: { namespaces: 'editor' },
  components: {
    AtomSpinner,
    StatusIndicator,
    editorApi: () => import(/* webpackChunkName: "editor-api", webpackMode: "lazy" */ './editor/editor-api.vue'),
    editorCode: () => import(/* webpackChunkName: "editor-code", webpackMode: "lazy" */ './editor/editor-code.vue'),
    editorCkeditor: () => import(/* webpackChunkName: "editor-ckeditor", webpackMode: "lazy" */ './editor/editor-ckeditor.vue'),
    editorAsciidoc: () => import(/* webpackChunkName: "editor-asciidoc", webpackMode: "lazy" */ './editor/editor-asciidoc.vue'),
    editorMarkdown: () => import(/* webpackChunkName: "editor-markdown", webpackMode: "lazy" */ './editor/editor-markdown.vue'),
    editorRedirect: () => import(/* webpackChunkName: "editor-redirect", webpackMode: "lazy" */ './editor/editor-redirect.vue'),
    editorModalEditorselect: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-editorselect.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-properties.vue'),
    editorModalUnsaved: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-unsaved.vue'),
    editorModalMedia: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-media.vue'),
    editorModalBlocks: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-blocks.vue'),
    editorModalConflict: () => import(/* webpackChunkName: "editor-conflict", webpackMode: "lazy" */ './editor/editor-modal-conflict.vue'),
    editorModalDrawio: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-drawio.vue')
  },
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    scriptCss: {
      type: String,
      default: ''
    },
    publishStartDate: {
      type: String,
      default: ''
    },
    publishEndDate: {
      type: String,
      default: ''
    },
    scriptJs: {
      type: String,
      default: ''
    },
    initEditor: {
      type: String,
      default: null
    },
    initMode: {
      type: String,
      default: 'create'
    },
    initContent: {
      type: String,
      default: null
    },
    pageId: {
      type: Number,
      default: 0
    },
    checkoutDate: {
      type: String,
      default: new Date().toISOString()
    },
    effectivePermissions: {
      type: String,
      default: ''
    },
    approvalStatus: {
      type: String,
      default: 'APPROVED'
    },
    approvalComment: {
      type: String,
      default: ''
    },
    pendingVersionId: {
      type: [Number, String],
      default: null
    },
    approverName: {
      type: String,
      default: ''
    },
    approverEmail: {
      type: String,
      default: ''
    },
    origin: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      isSaving: false,
      isConflict: false,
      dialogProps: false,
      dialogProgress: false,
      dialogEditorSelector: false,
      dialogUnsaved: false,
      exitConfirmed: false,
      initContentParsed: '',
      savedState: {
        description: '',
        isPublished: false,
        publishEndDate: '',
        publishStartDate: '',
        tags: '',
        title: '',
        css: '',
        js: ''
      },
      dialogReviewerComments: false,
      reviewerCommentsLoading: false,
      reviewerCommentsLoaded: false,
      reviewerComments: []
    }
  },
  computed: {
    currentEditor: sync('editor/editor'),
    activeModal: sync('editor/activeModal'),
    mode: get('editor/mode'),
    pageIdActive() {
      const storeId = this.$store.get('page/id')
      return _.isNumber(storeId) && storeId > 0 ? storeId : this.pageId
    },
    welcomeMode() { return this.mode === `create` && this.path === `home` },
    checkoutDateActive: sync('editor/checkoutDateActive'),
    currentStyling: get('page/scriptCss'),
    permissions: get('user/permissions'),
    pageApprovalStatus: get('page/approvalStatus'),
    approvalCommentStore: get('page/approvalComment'),
    pendingVersionStore: get('page/pendingVersionId'),
    originStore: get('page/origin'),
    approvalAlert() {
      const status = (this.pageApprovalStatus || 'APPROVED').toUpperCase()
      const comment = _.trim(this.approvalCommentStore || '')
      const isDarkTheme = _.get(this, '$vuetify.theme.dark', false)

      const variants = {
        PENDING: {
            icon: 'mdi-timer-sand',
          statusLabel: 'Awaiting approval',
            message: 'Changes are pending approval before they are published.',
          commentLabel: 'Reviewer comment',
          palette: {
            light: { bg: '#FFF3CD', text: '#5F4100', border: '#FFB74D' },
            dark: { bg: 'rgba(255, 193, 7, 0.18)', text: '#FFE082', border: '#FFB74D' }
          },
          iconColor: { light: '#FF9800', dark: '#FFC107' }
        },
        REJECTED: {
            icon: 'mdi-close-octagon',
          statusLabel: 'Submission rejected',
          message: 'The last submission was rejected. Review the feedback before resubmitting.',
          commentLabel: 'Reason',
          palette: {
            light: { bg: '#FFEBEE', text: '#7F0000', border: '#EF5350' },
            dark: { bg: 'rgba(244, 67, 54, 0.18)', text: '#FFCDD2', border: '#EF5350' }
          },
          iconColor: { light: '#E53935', dark: '#FF867C' }
        },
        DRAFT: {
            icon: 'mdi-progress-clock',
          statusLabel: 'Submission cancelled',
            message: 'Pending submission was cancelled. Adjust the content and submit again.',
          commentLabel: 'Note',
          palette: {
            light: { bg: '#ECEFF1', text: '#29434E', border: '#90A4AE' },
            dark: { bg: 'rgba(144, 164, 174, 0.18)', text: '#CFD8DC', border: '#90A4AE' }
          },
          iconColor: { light: '#607D8B', dark: '#B0BEC5' }
        }
      }

      const variant = variants[status]
      if (!variant) {
          return null
      }

      const tone = isDarkTheme ? variant.palette.dark : variant.palette.light
      return {
        status,
        statusLabel: variant.statusLabel,
        message: variant.message,
        commentLabel: variant.commentLabel,
        comment,
        icon: variant.icon,
        iconColor: isDarkTheme ? variant.iconColor.dark : variant.iconColor.light,
        className: `editor-approval-banner--${status.toLowerCase()}`,
        style: {
          backgroundColor: tone.bg,
          color: tone.text,
          borderLeftColor: tone.border
        }
      }
    },
    hasPublishPermission() {
      const perms = this.$store.get('page/effectivePermissions') || { pages: {} }
      return _.get(perms, 'pages.publish', false)
    },
    editorOrigin() {
      const storeOrigin = _.toString(this.originStore || '').toLowerCase()
      const propOrigin = _.toString(this.origin || '').toLowerCase()
      return propOrigin || storeOrigin
    },
    canPublish() {
      if (this.editorOrigin === 'approvals') {
        return false
      }
      if (this.hasPublishPermission) {
        return true
      }
      return this.hasAnyPermission(['publish:pages', 'approve:pages', 'manage:pages'])
    },
    requiresApproval() {
      return !this.canPublish
    },
    saveButtonColor() {
      return this.requiresApproval ? 'amber' : 'green'
    },
    saveButtonIcon() {
      if (this.requiresApproval) {
        return this.isDirty ? 'mdi-send-check' : 'mdi-timer-sand'
      }
      return 'mdi-check'
    },
    saveButtonLabel() {
      if (!this.$vuetify || !this.$vuetify.breakpoint.lgAndUp) {
        return ''
      }
      if (this.requiresApproval) {
        if (this.isDirty) {
          return this.$te && this.$te('editor:save.submitForApproval') ? this.$t('editor:save.submitForApproval') : 'Submit for Approval'
        }
        return this.$te && this.$te('editor:save.awaitingApproval') ? this.$t('editor:save.awaitingApproval') : 'Awaiting Approval'
      }
      if (this.mode !== 'create' && !this.isDirty) {
        return this.$t('editor:save.saved')
      }
      return this.$t(this.mode === 'create' ? 'common:actions.create' : 'common:actions.save')
    },
    showApprovalBanner() {
      return !!this.approvalAlert
    },
    isDirty () {
      const currentState = {
        description: this.$store.get('page/description'),
        isPublished: this.$store.get('page/isPublished'),
        publishEndDate: this.$store.get('page/publishEndDate') || '',
        publishStartDate: this.$store.get('page/publishStartDate') || '',
        tags: _.cloneDeep(this.$store.get('page/tags') || []),
        title: this.$store.get('page/title'),
        css: this.$store.get('page/scriptCss'),
        js: this.$store.get('page/scriptJs')
      }

      return _.some([
        this.initContentParsed !== this.$store.get('editor/content'),
        this.locale !== this.$store.get('page/locale'),
        this.path !== this.$store.get('page/path'),
        !_.isEqual(this.savedState, currentState)
      ], Boolean)
    }
  },
  watch: {
    currentEditor(newValue, oldValue) {
      if (newValue !== '' && this.mode === 'create') {
        _.delay(() => {
          this.dialogProps = true
        }, 500)
      }
    },
    currentStyling(newValue) {
      this.injectCustomCss(newValue)
    }
  },
  created() {
    this.$store.set('page/origin', _.toString(this.origin || '').toLowerCase())
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/description', this.description)
    this.$store.set('page/isPublished', this.isPublished)
    this.$store.set('page/publishStartDate', this.publishStartDate)
    this.$store.set('page/publishEndDate', this.publishEndDate)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/tags', this.tags)
    this.$store.set('page/title', this.title)
    this.$store.set('page/scriptCss', this.scriptCss)
    this.$store.set('page/scriptJs', this.scriptJs)

    this.updateApprovalState({
      approvalStatus: this.approvalStatus,
      approvalComment: this.approvalComment,
      pendingVersionId: this.pendingVersionId
    })

    this.$store.set('page/mode', 'edit')

    this.setCurrentSavedState()

    this.checkoutDateActive = this.checkoutDate

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  mounted() {
    this.$store.set('editor/mode', this.initMode || 'create')

    this.initContentParsed = this.initContent ? Base64.decode(this.initContent) : ''
    this.$store.set('editor/content', this.initContentParsed)
    if (this.mode === 'create' && !this.initEditor) {
      _.delay(() => {
        this.dialogEditorSelector = true
      }, 500)
    } else {
      this.currentEditor = `editor${_.startCase(this.initEditor || 'markdown')}`
    }

    window.onbeforeunload = () => {
      if (!this.exitConfirmed && this.initContentParsed !== this.$store.get('editor/content')) {
        return this.$t('editor:unsavedWarning')
      } else {
        return undefined
      }
    }

    this.$root.$on('resetEditorConflict', () => {
      this.isConflict = false
    })

    // this.$store.set('editor/mode', 'edit')
    // this.currentEditor = `editorApi`
  },
  methods: {
    async openReviewerComments() {
      this.dialogReviewerComments = true
      if (this.reviewerCommentsLoaded || !this.pageIdActive) {
        return
      }
      this.reviewerCommentsLoading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              pages {
                single(id: $id) {
                  approvalStatus
                  approvalComment
                  updatedAt
                }
                history(id: $id, offsetPage: 0, offsetSize: 25) {
                  trail {
                    versionId
                    versionDate
                    workflowStatus
                    approvalComment
                  }
                }
              }
            }
          `,
          variables: {
            id: this.pageIdActive
          },
          fetchPolicy: 'network-only'
        })
        const allComments = []

        // Add historical comments
        const entries = _.get(resp, 'data.pages.history.trail', [])
        const filtered = entries.filter(entry => _.isString(entry.approvalComment) && entry.approvalComment.trim().length > 0)
        const mapped = filtered.map(entry => {
          const meta = this.mapReviewStatus(entry.workflowStatus)
          return {
            versionId: entry.versionId,
            versionDate: entry.versionDate,
            comment: entry.approvalComment.trim(),
            status: meta.status,
            statusLabel: meta.label,
            chipColor: meta.chip
          }
        })

        allComments.push(...mapped)

        // Add current page approval comment if it exists and is not already in history
        const currentPage = _.get(resp, 'data.pages.single', null)
        if (currentPage && _.isString(currentPage.approvalComment) && currentPage.approvalComment.trim().length > 0) {
          const currentComment = currentPage.approvalComment.trim()
          const alreadyExists = allComments.some(c => c.comment === currentComment)
          if (!alreadyExists) {
            const meta = this.mapReviewStatus(currentPage.approvalStatus)
            allComments.push({
              versionId: 0,
              versionDate: currentPage.updatedAt,
              comment: currentComment,
              status: meta.status,
              statusLabel: meta.label,
              chipColor: meta.chip
            })
          }
        }

        this.reviewerComments = _.orderBy(allComments, ['versionDate'], ['desc'])
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.reviewerCommentsLoading = false
      this.reviewerCommentsLoaded = true
    },
    mapReviewStatus(status) {
      const normalized = _.toUpper(status || '')
      switch (normalized) {
        case 'PENDING':
          return { status: 'PENDING', label: 'Pending', chip: 'amber darken-2' }
        case 'APPROVED':
          return { status: 'APPROVED', label: 'Approved', chip: 'green darken-2' }
        case 'REJECTED':
          return { status: 'REJECTED', label: 'Rejected', chip: 'red darken-2' }
        case 'CANCELLED':
          return { status: 'CANCELLED', label: 'Cancelled', chip: 'blue-grey darken-2' }
        default:
          return { status: normalized || 'UNKNOWN', label: _.startCase(normalized || 'Unknown'), chip: 'grey darken-2' }
      }
    },
    hasAnyPermission(perms) {
      if (_.isArray(perms)) {
        return _.some(perms, p => _.includes(this.permissions, p))
      }
      return _.includes(this.permissions, perms)
    },
    updateApprovalState(payload = {}) {
      const status = (_.get(payload, 'approvalStatus', 'APPROVED') || 'APPROVED').toUpperCase()
      this.$store.set('page/approvalStatus', status)
      const comment = _.get(payload, 'approvalComment', '') || ''
      this.$store.set('page/approvalComment', comment)
      const pendingId = _.get(payload, 'pendingVersionId', null)
      const sanitizedPendingId = _.isFinite(_.toSafeInteger(pendingId)) && _.toSafeInteger(pendingId) > 0 ? _.toSafeInteger(pendingId) : null
      this.$store.set('page/pendingVersionId', sanitizedPendingId)
      return status
    },
    openPropsModal(name) {
      this.dialogProps = true
    },
    showProgressDialog(textKey) {
      this.dialogProgress = true
    },
    hideProgressDialog() {
      this.dialogProgress = false
    },
    openConflict() {
      this.$root.$emit('save-conflict')
    },
    async save({ rethrow = false, overwrite = false } = {}) {
      this.showProgressDialog('saving')
      this.isSaving = true

      const canPublish = this.canPublish
      let previousPublishState = null
      if (!canPublish) {
        previousPublishState = this.$store.get('page/isPublished')
        this.$store.set('page/isPublished', false)
      }

      const saveTimeoutHandle = setTimeout(() => {
        throw new Error('Save operation timed out.')
      }, 30000)

      try {
        if (this.$store.get('editor/mode') === 'create') {
          // --------------------------------------------
          // -> CREATE PAGE
          // --------------------------------------------

          let resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $content: String!
                $description: String!
                $editor: String!
                $isPrivate: Boolean!
                $isPublished: Boolean!
                $locale: String!
                $path: String!
                $publishEndDate: Date
                $publishStartDate: Date
                $scriptCss: String
                $scriptJs: String
                $tags: [String]!
                $title: String!
              ) {
                pages {
                  create(
                    content: $content
                    description: $description
                    editor: $editor
                    isPrivate: $isPrivate
                    isPublished: $isPublished
                    locale: $locale
                    path: $path
                    publishEndDate: $publishEndDate
                    publishStartDate: $publishStartDate
                    scriptCss: $scriptCss
                    scriptJs: $scriptJs
                    tags: $tags
                    title: $title
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    page {
                      id
                      updatedAt
                      approvalStatus
                      approvalComment
                      pendingVersionId
                    }
                  }
                }
              }
            `,
            variables: {
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: this.$store.get('editor/editorKey'),
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
              scriptCss: this.$store.get('page/scriptCss'),
              scriptJs: this.$store.get('page/scriptJs'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title')
            }
          })
          resp = _.get(resp, 'data.pages.create', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            const status = this.updateApprovalState(_.get(resp, 'page', {}))
            this.checkoutDateActive = _.get(resp, 'page.updatedAt', this.checkoutDateActive)
            this.isConflict = false
            this.$store.set('editor/id', _.get(resp, 'page.id'))
            this.$store.set('editor/mode', 'update')
            this.$store.set('page/id', _.get(resp, 'page.id', this.$store.get('page/id')))
            if (status === 'APPROVED') {
              this.$store.commit('showNotification', {
                message: this.$t('editor:save.createSuccess'),
                style: 'success',
                icon: 'check'
              })
              this.exitConfirmed = true
              window.location.assign(`/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
            } else if (status === 'PENDING') {
              this.$store.commit('showNotification', {
                message: 'Page submitted for approval.',
                style: 'info',
                icon: 'timer'
              })
            } else if (status === 'REJECTED') {
              this.$store.commit('showNotification', {
                message: 'Submission rejected. Review the comment and try again.',
                style: 'error',
                icon: 'alert-circle'
              })
            } else {
              this.$store.commit('showNotification', {
                message: 'Page saved as draft.',
                style: 'info',
                icon: 'content-save'
              })
            }
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        } else {
          // --------------------------------------------
          // -> UPDATE EXISTING PAGE
          // --------------------------------------------

          const conflictResp = await this.$apollo.query({
            query: gql`
              query ($id: Int!, $checkoutDate: Date!) {
                pages {
                  checkConflicts(id: $id, checkoutDate: $checkoutDate)
                }
              }
            `,
            fetchPolicy: 'network-only',
            variables: {
              id: this.pageIdActive,
              checkoutDate: this.checkoutDateActive
            }
          })
          if (_.get(conflictResp, 'data.pages.checkConflicts', false)) {
            this.$root.$emit('save-conflict')
            throw new Error(this.$t('editor:conflict.warning'))
          }

          let resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $id: Int!
                $content: String
                $description: String
                $editor: String
                $isPrivate: Boolean
                $isPublished: Boolean
                $locale: String
                $path: String
                $publishEndDate: Date
                $publishStartDate: Date
                $scriptCss: String
                $scriptJs: String
                $tags: [String]
                $title: String
                $keepPending: Boolean
              ) {
                pages {
                  update(
                    id: $id
                    content: $content
                    description: $description
                    editor: $editor
                    isPrivate: $isPrivate
                    isPublished: $isPublished
                    locale: $locale
                    path: $path
                    publishEndDate: $publishEndDate
                    publishStartDate: $publishStartDate
                    scriptCss: $scriptCss
                    scriptJs: $scriptJs
                    tags: $tags
                    title: $title
                    keepPending: $keepPending
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    page {
                      updatedAt
                      approvalStatus
                      approvalComment
                      pendingVersionId
                    }
                  }
                }
              }
            `,
            variables: {
              id: this.pageIdActive,
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: this.$store.get('editor/editorKey'),
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
              scriptCss: this.$store.get('page/scriptCss'),
              scriptJs: this.$store.get('page/scriptJs'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title'),
              keepPending: this.editorOrigin === 'approvals'
            }
          })
          resp = _.get(resp, 'data.pages.update', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            const status = this.updateApprovalState(_.get(resp, 'page', {}))
            this.checkoutDateActive = _.get(resp, 'page.updatedAt', this.checkoutDateActive)
            this.isConflict = false
            if (status === 'APPROVED') {
              this.$store.commit('showNotification', {
                message: this.$t('editor:save.updateSuccess'),
                style: 'success',
                icon: 'check'
              })
              if (this.locale !== this.$store.get('page/locale') || this.path !== this.$store.get('page/path')) {
                _.delay(() => {
                  window.location.replace(`/e/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
                }, 1000)
              }
            } else if (status === 'PENDING') {
              this.$store.commit('showNotification', {
                message: 'Changes submitted for approval.',
                style: 'info',
                icon: 'timer'
              })
            } else if (status === 'REJECTED') {
              this.$store.commit('showNotification', {
                message: 'Latest submission is marked as rejected. Review the comment and update the page.',
                style: 'error',
                icon: 'alert-circle'
              })
            } else if (status === 'DRAFT') {
              this.$store.commit('showNotification', {
                message: 'Draft saved. Submit again when you are ready.',
                style: 'info',
                icon: 'content-save'
              })
            }
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        }

        this.initContentParsed = this.$store.get('editor/content')
        this.setCurrentSavedState()
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
        if (rethrow === true) {
          if (!canPublish && previousPublishState !== null) {
            this.$store.set('page/isPublished', previousPublishState)
          }
          clearTimeout(saveTimeoutHandle)
          this.isSaving = false
          this.hideProgressDialog()
          throw err
        }
      } finally {
        if (!canPublish && previousPublishState !== null) {
          this.$store.set('page/isPublished', previousPublishState)
        }
      }
      clearTimeout(saveTimeoutHandle)
      this.isSaving = false
      this.hideProgressDialog()
    },
    async saveAndClose() {
      try {
        if (this.$store.get('editor/mode') === 'create') {
          await this.save()
        } else {
          await this.save({ rethrow: true })
          await this.exit()
        }
      } catch (err) {
        // Error is already handled
      }
    },
    async exit() {
      if (this.isDirty) {
        this.dialogUnsaved = true
      } else {
        this.exitGo()
      }
    },
    exitGo() {
      this.$store.commit(`loadingStart`, 'editor-close')
      this.currentEditor = ''
      this.exitConfirmed = true
      _.delay(() => {
        if (this.$store.get('editor/mode') === 'create') {
          window.location.assign(`/`)
        } else {
          window.location.assign(`/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
        }
      }, 500)
    },
    setCurrentSavedState () {
      this.savedState = {
        description: this.$store.get('page/description'),
        isPublished: this.$store.get('page/isPublished'),
        publishEndDate: this.$store.get('page/publishEndDate') || '',
        publishStartDate: this.$store.get('page/publishStartDate') || '',
        tags: _.cloneDeep(this.$store.get('page/tags') || []),
        title: this.$store.get('page/title'),
        css: this.$store.get('page/scriptCss'),
        js: this.$store.get('page/scriptJs')
      }
    },
    injectCustomCss: _.debounce(css => {
      const oldStyl = document.querySelector('#editor-script-css')
      if (oldStyl) {
        document.head.removeChild(oldStyl)
      }
      if (!_.isEmpty(css)) {
        const styl = document.createElement('style')
        styl.type = 'text/css'
        styl.id = 'editor-script-css'
        document.head.appendChild(styl)
        styl.appendChild(document.createTextNode(css))
      }
    }, 1000)
  },
  apollo: {
    isConflict: {
      query: gql`
        query ($id: Int!, $checkoutDate: Date!) {
          pages {
            checkConflicts(id: $id, checkoutDate: $checkoutDate)
          }
        }
      `,
      fetchPolicy: 'network-only',
      pollInterval: 5000,
      variables () {
        return {
          id: this.pageId,
          checkoutDate: this.checkoutDateActive
        }
      },
      update: (data) => _.cloneDeep(data.pages.checkConflicts),
      skip () {
        return this.mode === 'create' || this.isSaving || !this.isDirty
      }
    }
  }
}
</script>

<style lang='scss'>

  .editor {
    background-color: mc('grey', '900') !important;
    min-height: 100vh;

    .application--wrap {
      background-color: mc('grey', '900');
    }

  }

  .editor .nav-notify {
    top: 0;
    padding-top: 16px;
  }

  .editor .nav-notify .v-snack__wrapper {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }

  .editor-approval-banner {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 12px;
    border-left: 6px solid transparent;
  }

  .editor-approval-banner__icon {
    font-size: 28px;
    line-height: 1;
    margin-top: 2px;
  }

  .editor-approval-banner__body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }

  .editor-approval-banner__status {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    opacity: 0.85;
  }

  .editor-approval-banner__message {
    margin-top: 4px;
    font-weight: 600;
    font-size: 1rem;
  }

  .editor-approval-banner__comment {
    margin-top: 8px;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .editor-approval-banner__comment-label {
    font-weight: 600;
    margin-right: 4px;
  }

  .reviewer-note-item {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .theme--dark .reviewer-note-item {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .atom-spinner.is-inline {
    display: inline-block;
  }

</style>
