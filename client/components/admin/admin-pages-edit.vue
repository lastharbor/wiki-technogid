<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap, v-if='page.id')
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-view-details.svg', alt='Edit Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Page Details
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s
              v-chip.ml-0.mr-2(label, small).caption ID {{page.id}}
              span /{{page.locale}}/{{page.path}}
              v-chip.ml-2(label, small, :color='approvalStyle.color', :text-color='approvalStyle.text') {{ approvalLabel }}
          v-spacer
          template(v-if='page.isPublished')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text {{$t('common:page.published')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text {{$t('common:page.unpublished')}}
          template(v-if='page.isPrivate')
            status-indicator.mr-3.ml-4(intermediary, pulse)
            .caption.deep-orange--text {{$t('common:page.private')}}
          template(v-else)
            status-indicator.mr-3.ml-4(active, pulse)
            .caption.blue--text {{$t('common:page.global')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(color='grey', icon, outlined, to='/pages')
            v-icon mdi-arrow-left
          v-menu(offset-y, origin='top right')
            template(v-slot:activator='{ on }')
              v-btn.mx-3.animated.fadeInDown.wait-p2s(color='black', v-on='on', depressed, dark)
                span Actions
                v-icon(right) mdi-chevron-down
            v-list(dense, nav)
              v-list-item(:href='`/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-text-subject
                v-list-item-title View
              v-list-item(:href='`/e/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-pencil
                v-list-item-title Edit
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-cube-scan
                v-list-item-title Re-Render
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-earth-remove
                v-list-item-title Unpublish
              v-list-item(:href='`/s/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-code-tags
                v-list-item-title View Source
              v-list-item(:href='`/h/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-history
                v-list-item-title View History
              v-divider(v-if='hasPending && (canApprove || canCancel)')
              v-list-item(v-if='hasPending && canApprove', @click='approveDialog = true')
                v-list-item-icon
                  v-icon(color='green') mdi-check-decagram
                v-list-item-title Approve Pending Changes
              v-list-item(v-if='hasPending && canReject', @click='rejectDialog = true')
                v-list-item-icon
                  v-icon(color='deep-orange') mdi-close-octagon
                v-list-item-title Reject Pending Changes
              v-list-item(v-if='hasPending && canCancel', @click='cancelDialog = true')
                v-list-item-icon
                  v-icon(color='amber darken-2') mdi-backspace
                v-list-item-title Cancel Pending Submission
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-content-duplicate
                v-list-item-title Duplicate
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-content-save-move-outline
                v-list-item-title Move / Rename
              v-dialog(v-model='deletePageDialog', max-width='500')
                template(v-slot:activator='{ on }')
                  v-list-item(v-on='on')
                    v-list-item-icon
                      v-icon(color='red') mdi-trash-can-outline
                    v-list-item-title Delete
                v-card
                  .dialog-header.is-short.is-red
                    v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
                    span {{$t('common:page.delete')}}
                  v-card-text.pt-5
                    i18next.body-2(path='common:page.deleteTitle', tag='div')
                      span.red--text.text--darken-2(place='title') {{page.title}}
                    .caption {{$t('common:page.deleteSubtitle')}}
                    v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', disabled, small)
                      .caption.red--text.text--darken-2 {{page.locale.toUpperCase()}}
                    v-chip.mt-3.mx-0(label, color='red lighten-5', disabled, small)
                      span.red--text.text--darken-2 /{{page.path}}
                  v-card-chin
                    v-spacer
                    v-btn(text, @click='deletePageDialog = false', :disabled='loading') {{$t('common:actions.cancel')}}
                    v-btn(color='red darken-2', @click='deletePage', :loading='loading').white--text {{$t('common:actions.delete')}}
          v-dialog(v-model='approveDialog', max-width='520')
            v-card
              .dialog-header.is-short.is-green
                v-icon.mr-2(color='white') mdi-check-decagram
                span Approve Pending Changes
              v-card-text.pt-5
                .body-2.grey--text.text--darken-2 Provide an optional comment for the author.
                v-textarea.mt-4(
                  label='Comment (optional)'
                  auto-grow
                  outlined
                  dense
                  v-model='approveComment'
                  :disabled='actionLoading'
                )
                v-switch.mt-2(
                  inset
                  color='green'
                  label='Publish immediately after approval'
                  v-model='approvePublish'
                  :disabled='actionLoading'
                )
              v-card-chin
                v-spacer
                v-btn(text, @click='approveDialog = false', :disabled='actionLoading') {{$t('common:actions.cancel')}}
                v-btn(color='green darken-2', @click='approvePendingChanges', :loading='actionLoading').white--text Approve
          v-dialog(v-model='rejectDialog', max-width='520')
            v-card
              .dialog-header.is-short.is-deep-orange
                v-icon.mr-2(color='white') mdi-close-octagon
                span Reject Pending Changes
              v-card-text.pt-5
                .body-2.grey--text.text--darken-2 Explain why the submission is rejected.
                v-textarea.mt-4(
                  label='Rejection comment'
                  auto-grow
                  outlined
                  dense
                  v-model='rejectComment'
                  :disabled='actionLoading'
                )
              v-card-chin
                v-spacer
                v-btn(text, @click='rejectDialog = false', :disabled='actionLoading') {{$t('common:actions.cancel')}}
                v-btn(color='deep-orange darken-2', @click='rejectPendingChanges', :loading='actionLoading').white--text Reject
          v-dialog(v-model='cancelDialog', max-width='520')
            v-card
              .dialog-header.is-short.is-amber
                v-icon.mr-2(color='white') mdi-backspace
                span Cancel Pending Submission
              v-card-text.pt-5
                .body-2.grey--text.text--darken-2 This will withdraw the pending changes. Authors can continue editing afterwards.
              v-card-chin
                v-spacer
                v-btn(text, @click='cancelDialog = false', :disabled='actionLoading') {{$t('common:actions.cancel')}}
                v-btn(color='amber darken-2', dark, @click='cancelPendingChanges', :loading='actionLoading') Confirm
          v-btn.animated.fadeInDown(color='success', large, depressed, disabled)
            v-icon(left) mdi-check
            span Save Changes
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-text-subject
            span Properties
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Title
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.title }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Description
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.description || '-' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Locale
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.locale }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Path
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.path }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Editor
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.editor || '?' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Content Type
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.contentType || '?' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Approval Status
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ approvalLabel }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Approver
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ approverDisplay }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Review Comment
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ approvalCommentDisplay }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Page Hash
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.hash }}

      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-multiple
            span Users
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='24')
                v-btn(icon, :to='`/users/` + page.creatorId')
                  v-icon(color='grey') mdi-account
              v-list-item-content
                v-list-item-title: .overline.grey--text Creator
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.creatorName }} #[em.caption ({{ page.creatorEmail }})]
              v-list-item-action
                v-list-item-action-text {{ page.createdAt | moment('calendar') }}
            v-divider
            v-list-item
              v-list-item-avatar(size='24')
                v-btn(icon, :to='`/users/` + page.authorId')
                  v-icon(color='grey') mdi-account
              v-list-item-content
                v-list-item-title: .overline.grey--text Last Editor
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.authorName }} #[em.caption ({{ page.authorEmail }})]
              v-list-item-action
                v-list-item-action-text {{ page.updatedAt | moment('calendar') }}

    v-layout(row, wrap, v-if='hasPending && pendingVersion')
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p3s
          v-toolbar(color='amber darken-2', dense, dark, flat)
            v-icon.mr-2 mdi-timer-sand
            span Pending Submission
            v-spacer
            v-chip(label, small, color='amber lighten-4', text-color='amber darken-4') {{ pendingVersion.workflowStatus || 'PENDING' }}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Proposed Title
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ pendingVersion.title || page.title }}
            v-divider
            v-list-item
              v-list-item-avatar(size='24')
                v-btn(icon, :to='`/users/` + pendingVersion.authorId')
                  v-icon(color='grey') mdi-account
              v-list-item-content
                v-list-item-title: .overline.grey--text Submitted By
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ pendingVersion.authorName }}
              v-list-item-action
                v-list-item-action-text {{ pendingVersion.versionDate | moment('calendar') }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Reviewer Comment
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-3` : `grey--text text--darken-3`') {{ pendingReviewerComment }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Tags
                v-list-item-subtitle
                  template(v-if='pendingVersion.tags && pendingVersion.tags.length')
                    v-chip.ma-1(label, small, color='indigo lighten-5', text-color='indigo darken-3', v-for='tag in pendingVersion.tags', :key='tag') {{ tag }}
                  span.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`', v-else) None
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Publish When Approved
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ pendingVersion.isPublished ? 'Publish immediately' : 'Keep as draft' }}
          v-card-actions
            v-icon.mr-2(color='amber darken-2') mdi-information
            span.caption.grey--text.text--darken-2 Pending changes are waiting for approval.
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p3s
          v-toolbar(color='green darken-2', dense, dark, flat)
            v-icon.mr-2 mdi-file-check-outline
            span Current Published Version
            v-spacer
            v-chip(label, small, color='green lighten-4', text-color='green darken-4') {{ publishedStatus }}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Last Updated
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.updatedAt | moment('calendar') }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Reviewer Comment
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-3` : `grey--text text--darken-3`') {{ approvalCommentDisplay }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Tags
                v-list-item-subtitle
                  template(v-if='pageTags && pageTags.length')
                    v-chip.ma-1(label, small, color='teal lighten-5', text-color='teal darken-3', v-for='tag in pageTags', :key='tag') {{ tag }}
                  span.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`', v-else) None
          v-card-actions
            v-icon.mr-2(color='green darken-2') mdi-information
            span.caption.grey--text.text--darken-2 Current published content shown above.

    v-layout(row, wrap, v-else-if='!hasPending')
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p3s
          v-toolbar(:color='approvalStatus === "APPROVED" ? "green darken-2" : "blue-grey darken-2"', dense, dark, flat)
            v-icon.mr-2(:color='approvalStatus === "APPROVED" ? "white" : "white"') mdi-file-check-outline
            span {{ approvalStatus === 'APPROVED' ? 'Approved Submission' : 'No Pending Submission' }}
            v-spacer
            v-chip(label, small, :color='approvalStatus === "APPROVED" ? "green lighten-4" : "blue-grey lighten-4"', :text-color='approvalStatus === "APPROVED" ? "green darken-4" : "blue-grey darken-3"') {{ approvalStatus }}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Last Reviewed
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.updatedAt | moment('calendar') }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Reviewer Comment
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-3` : `grey--text text--darken-3`') {{ approvalCommentDisplay }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Tags
                v-list-item-subtitle
                  template(v-if='pageTags && pageTags.length')
                    v-chip.ma-1(label, small, color='teal lighten-5', text-color='teal darken-3', v-for='tag in pageTags', :key='tag') {{ tag }}
                  span.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`', v-else) None
          v-card-actions
            v-icon.mr-2(:color='approvalStatus === "APPROVED" ? "green darken-2" : "blue-grey darken-2"') mdi-information
            span.caption.grey--text.text--darken-2(v-if='approvalStatus === "APPROVED"') The latest submission is live.
            span.caption.grey--text.text--darken-2(v-else) This page currently has no pending submissions.

</template>
<script>
import _ from 'lodash'
import { StatusIndicator } from 'vue-status-indicator'
import { get } from 'vuex-pathify'

import pageQuery from 'gql/admin/pages/pages-query-single.gql'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
import approvePageMutation from 'gql/admin/pages/pages-mutation-approve.gql'
import rejectPageMutation from 'gql/admin/pages/pages-mutation-reject.gql'
import cancelPendingMutation from 'gql/admin/pages/pages-mutation-cancel.gql'

export default {
  components: {
    StatusIndicator
  },
  computed: {
    permissions: get('user/permissions'),
    currentUserId: get('user/id'),
    approvalStatus() {
      return (this.page.approvalStatus || 'APPROVED').toUpperCase()
    },
    approvalStyle() {
      return this.approvalStatusStyles[this.approvalStatus] || this.approvalStatusStyles.APPROVED
    },
    approvalLabel() {
      return _.startCase(this.approvalStatus.toLowerCase())
    },
    pageTags() {
      if (Array.isArray(this.page.tags)) {
        return this.page.tags
      }
      return []
    },
    pendingReviewerComment() {
      const comment = _.get(this.pendingVersion, 'approvalComment', '')
      if (_.isString(comment) && comment.trim().length > 0) {
        return comment.trim()
      }
      if (this.approvalCommentDisplay !== '-') {
        return this.approvalCommentDisplay
      }
      return 'None'
    },
    canApprove() {
      return this.approvalStatus === 'PENDING' && this.hasPermission(['approve:pages', 'manage:pages'])
    },
    canReject() {
      return this.canApprove
    },
    canCancel() {
      return this.approvalStatus === 'PENDING' && (this.page.authorId === this.currentUserId || this.hasPermission(['manage:pages']))
    },
    pendingVersion() {
      return this.page.pendingVersion || null
    },
    hasPending() {
      return this.approvalStatus === 'PENDING' && !!this.page.pendingVersionId
    },
    publishedStatus() {
      // When there's a pending submission, the published version is APPROVED
      // When there's no pending submission, use the actual approval status
      if (this.hasPending) {
        return 'APPROVED'
      }
      return this.approvalStatus
    },
    approverDisplay() {
      if (!this.page.approverName) { return '-' }
      if (this.page.approverEmail) {
        return `${this.page.approverName} (${this.page.approverEmail})`
      }
      return this.page.approverName
    },
    approvalCommentDisplay() {
      return this.page.approvalComment && this.page.approvalComment.length ? this.page.approvalComment : '-'
    }
  },
  data() {
    return {
      deletePageDialog: false,
      page: {},
      loading: false,
      actionLoading: false,
      approveDialog: false,
      rejectDialog: false,
      cancelDialog: false,
      approveComment: '',
      approvePublish: true,
      rejectComment: '',
      approvalStatusStyles: {
        APPROVED: { color: 'green lighten-4', text: 'green darken-2' },
        PENDING: { color: 'amber lighten-4', text: 'amber darken-4' },
        REJECTED: { color: 'red lighten-4', text: 'red darken-2' },
        DRAFT: { color: 'blue-grey lighten-4', text: 'blue-grey darken-2' }
      }
    }
  },
  methods: {
    hasPermission(prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => _.includes(this.permissions, p))
      }
      return _.includes(this.permissions, prm)
    },
    async deletePage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      try {
        const resp = await this.$apollo.mutate({
          mutation: deletePageMutation,
          variables: {
            id: this.page.id
          }
        })
        if (_.get(resp, 'data.pages.delete.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: `Page deleted successfully.`,
            icon: 'check'
          })
          this.$router.replace('/pages')
        } else {
          throw new Error(_.get(resp, 'data.pages.delete.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.deletePageDialog = false
      this.$store.commit(`loadingStop`, 'page-delete')
    },
    async approvePendingChanges() {
      this.actionLoading = true
      this.$store.commit(`loadingStart`, 'page-approve')
      try {
        const resp = await this.$apollo.mutate({
          mutation: approvePageMutation,
          variables: {
            id: this.page.id,
            comment: this.approveComment || null,
            publish: this.approvePublish
          }
        })
        const result = _.get(resp, 'data.pages.approve.responseResult', {})
        if (result.succeeded) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: result.message || 'Pending changes approved.',
            icon: 'check'
          })
          await this.$apollo.queries.page.refetch()
          this.approveDialog = false
          this.approveComment = ''
        } else {
          throw new Error(result.message || this.$t('common:error.unexpected'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'page-approve')
      this.actionLoading = false
    },
    async rejectPendingChanges() {
      this.actionLoading = true
      this.$store.commit(`loadingStart`, 'page-reject')
      try {
        const resp = await this.$apollo.mutate({
          mutation: rejectPageMutation,
          variables: {
            id: this.page.id,
            comment: this.rejectComment || null
          }
        })
        const result = _.get(resp, 'data.pages.reject.responseResult', {})
        if (result.succeeded) {
          this.$store.commit('showNotification', {
            style: 'orange',
            message: result.message || 'Pending changes rejected.',
            icon: 'alert'
          })
          await this.$apollo.queries.page.refetch()
          this.rejectDialog = false
          this.rejectComment = ''
        } else {
          throw new Error(result.message || this.$t('common:error.unexpected'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'page-reject')
      this.actionLoading = false
    },
    async cancelPendingChanges() {
      this.actionLoading = true
      this.$store.commit(`loadingStart`, 'page-cancel-pending')
      try {
        const resp = await this.$apollo.mutate({
          mutation: cancelPendingMutation,
          variables: {
            id: this.page.id
          }
        })
        const result = _.get(resp, 'data.pages.cancelPending.responseResult', {})
        if (result.succeeded) {
          this.$store.commit('showNotification', {
            style: 'amber',
            message: result.message || 'Pending submission cancelled.',
            icon: 'undo'
          })
          await this.$apollo.queries.page.refetch()
          this.cancelDialog = false
        } else {
          throw new Error(result.message || this.$t('common:error.unexpected'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'page-cancel-pending')
      this.actionLoading = false
    },
    async rerenderPage() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    }
  },
  watch: {
    page: {
      handler(newPage) {
        this.approvePublish = _.get(newPage, 'isPublished', true)
      },
      immediate: true
    },
    approveDialog(val) {
      if (!val) {
        this.approveComment = ''
        this.approvePublish = _.get(this.page, 'isPublished', true)
      }
    },
    rejectDialog(val) {
      if (!val) {
        this.rejectComment = ''
      }
    }
  },
  apollo: {
    page: {
      query: pageQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => {
        const page = data.pages.single
        if (!page) { return {} }
        const pendingVersion = page.pendingVersion ? {
          ...page.pendingVersion,
          workflowStatus: (page.pendingVersion.workflowStatus || 'PENDING').toUpperCase(),
          tags: page.pendingVersion.tags || [],
          isPublished: page.pendingVersion.isPublished === true || page.pendingVersion.isPublished === 1
        } : null
        return {
          ...page,
          approvalStatus: (page.approvalStatus || 'APPROVED').toUpperCase(),
          pendingVersion,
          tags: Array.isArray(page.tags) ? page.tags.map(t => (t.tag || t)) : []
        }
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
