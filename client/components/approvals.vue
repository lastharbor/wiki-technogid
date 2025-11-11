<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').approvals
    nav-header(:hide-search='true')
    v-main(:class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-4"')
      v-container(fluid, class='pa-6')
        v-row(dense)
          v-col(xs12, :md='hasQueue ? 4 : 12')
            v-card.elevation-2
              v-toolbar(flat, dense, color='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
                v-toolbar-title.font-weight-medium {{$t('approvals:queue.title')}}
                v-spacer
                v-btn(icon, :loading='queueLoading', @click='refreshQueue', :aria-label='$t(`approvals:queue.refresh`)')
                  v-icon(color='grey') mdi-refresh
              v-divider
              v-card-text.pb-0
                v-select.mb-3(
                  dense
                  outlined
                  hide-details
                  color='primary'
                  :items='statusFilters'
                  v-model='statusFilter'
                  :label='$t(`approvals:queue.filterByStatus`)'
                  :disabled='queueLoading'
                )
              v-divider
              v-card-text.py-0
                template(v-if='queueLoading')
                  v-skeleton-loader(type='list-item', class='my-3')
                template(v-else-if='hasQueue')
                  v-list(dense, nav)
                    v-list-item(
                      v-for='item in queue'
                      :key='item.id'
                      :class='{ "approvals-queue-item--active": item.id === selectedId }'
                      @click='selectItem(item)'
                    )
                      v-list-item-content
                        v-list-item-title.font-weight-medium {{ item.pendingTitle || item.currentTitle }}
                        v-list-item-subtitle
                          span.grey--text {{ item.locale }} • /{{ item.path }}
                      v-list-item-action
                        v-chip(:color='statusMeta(item.approvalStatus).chip', small, dark) {{ statusMeta(item.approvalStatus).label }}
                template(v-else)
                  v-sheet.empty-queue-state.elevation-0.text-center(:class='emptyStateBackground')
                    v-icon.mb-4(color='primary', :size='48') mdi-clipboard-check-outline
                    p.subtitle-1.font-weight-medium.mb-1 {{$t('approvals:queue.allCaughtUp')}}
                    p.caption.grey--text.text--darken-1.mb-0 {{$t('approvals:queue.emptyMessage')}}
                    v-btn.mt-4(color='primary', text, @click='refreshQueue', :disabled='queueLoading')
                      v-icon(left, small) mdi-refresh
                      span {{$t('approvals:queue.refresh')}}
          v-col(xs12, md8, v-if='hasQueue || detailLoading')
            v-card.elevation-2(min-height='480')
              template(v-if='detailLoading')
                v-card-text
                  v-skeleton-loader(type='heading, paragraph, paragraph, actions')
              template(v-else-if='!detail')
                v-card-text
                  v-alert(type='info', text, outlined) {{$t('approvals:detail.selectPage')}}
              template(v-else)
                v-card-title.d-flex.align-center.flex-wrap
                  div
                    div.headline.mb-1 {{ detail.currentTitle }}
                    div.caption.grey--text {{ detail.locale }} • /{{ detail.path }}
                  v-spacer
                  v-tooltip(bottom, v-if='canEditSelected')
                    template(v-slot:activator='{ on }')
                      v-btn(icon, v-on='on', @click='editSelected', :aria-label='$t(`approvals:detail.editPending`)')
                        v-icon(color='grey') mdi-pencil
                    span {{$t('approvals:detail.editPending')}}
                  v-chip.ml-2(:color='statusMeta(detail.approvalStatus).chip', dark) {{ statusMeta(detail.approvalStatus).label }}
                v-card-subtitle
                  span.mr-2 Last updated {{ detail.currentUpdatedAt | moment('calendar') }}
                  span(v-if='detail.approvalComment && detail.approvalComment.length') · {{$t('approvals:detail.moderatorNote')}}: {{ detail.approvalComment }}
                v-divider
                v-card-text
                  v-row(dense)
                    v-col(cols='12', md='6')
                      .overline.grey--text {{$t('approvals:detail.submitter')}}
                      div.font-weight-medium {{ detail.pendingVersion && detail.pendingVersion.author ? detail.pendingVersion.author.name : 'Unknown' }}
                      div.caption.grey--text(v-if='detail.pendingVersion && detail.pendingVersion.author') {{ detail.pendingVersion.author.email }}
                      div.caption.grey--text.mt-2(v-if='selectedQueueItem && selectedQueueItem.submittedAt') {{$t('approvals:detail.submitted')}} {{ selectedQueueItem.submittedAt | moment('calendar') }}
                    v-col(cols='12', md='6')
                      .overline.grey--text {{$t('approvals:detail.publicationState')}}
                      div.font-weight-medium {{ detail.currentIsPublished ? $t('approvals:detail.published') : $t('approvals:detail.notPublished') }}
                      div.caption.grey--text {{$t('approvals:detail.currentApproval')}}: {{ statusMeta(detail.approvalStatus).label }}
                  v-divider.my-4
                  .approvals-toggle-bar
                    v-btn-toggle.version-toggle(v-model='versionSelection', tile, color='primary')
                      v-btn(value='pending', :disabled='!pendingAvailable')
                        v-icon(left, small) mdi-clock-edit-outline
                        span {{$t('approvals:versions.pending')}}
                      v-btn(value='live')
                        v-icon(left, small) mdi-earth
                        span {{$t('approvals:versions.current')}}
                    v-btn-toggle.content-toggle(v-model='contentView', tile, color='secondary')
                      v-btn(value='render')
                        v-icon(left, small) mdi-eye
                        span {{$t('approvals:view.rendered')}}
                      v-btn(value='source')
                        v-icon(left, small) mdi-code-tags
                        span {{$t('approvals:view.source')}}
                  v-sheet.mt-3.elevation-1.rounded-lg(:class='$vuetify.theme.dark ? "grey darken-3" : "grey lighten-5"', height='320', style='overflow-y:auto;')
                    div.pa-4(v-if='activeVersion && contentView === "render"')
                      div.approvals-render(v-html='sanitizedRender')
                    pre.pa-4.mb-0.font-mono.text-body-2(v-else-if='activeVersion') {{ activeVersion.content }}
                    div.pa-4.grey--text.text--darken-1(v-else) No content available.
                  v-divider.my-4
                  v-textarea(
                    v-model='comment'
                    rows='3'
                    auto-grow
                    outlined
                    :label='$t(`approvals:actions.comment`)'
                    :hint='$t(`approvals:actions.commentPlaceholder`)'
                    persistent-hint
                  )
                  v-switch(
                    v-if='canPublishDirect'
                    v-model='publishOnApprove'
                    inset
                    :label='$t(`approvals:actions.publish`)'
                    color='primary'
                  )
                v-card-actions
                  v-spacer
                  v-btn(text, color='grey', @click='refreshDetail', :disabled='actionLoading')
                    v-icon(left, small) mdi-refresh
                    span {{$t('approvals:queue.refresh')}}
                  v-btn(color='red darken-2', class='white--text', @click='rejectSelected', :loading='actionLoading', :disabled='!detail')
                    v-icon(left, small) mdi-close-thick
                    span {{$t('approvals:actions.reject')}}
                  v-btn(color='green darken-2', class='white--text', @click='approveSelected', :loading='actionLoading', :disabled='!detail')
                    v-icon(left, small) mdi-check-decagram
                    span {{$t('approvals:actions.approve')}}
    nav-footer
    notify
    search-results
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import DOMPurify from 'dompurify'

import approvalQueueQuery from 'gql/approvals/approval-query-queue.gql'
import approvalDetailQuery from 'gql/approvals/approval-query-detail.gql'
import approvePageMutation from 'gql/admin/pages/pages-mutation-approve.gql'
import rejectPageMutation from 'gql/admin/pages/pages-mutation-reject.gql'

export default {
  data() {
    return {
      queue: [],
      queueLoading: false,
      selectedId: null,
      selectedQueueItem: null,
      detail: null,
      detailLoading: false,
      statusFilter: 'PENDING',
      versionSelection: 'pending',
      contentView: 'render',
      comment: '',
      publishOnApprove: true,
      actionLoading: false
    }
  },
  computed: {
    permissions: get('user/permissions'),
    statusFilters() {
      return [
        { text: this.$t('approvals:status.pending'), value: 'PENDING' },
        { text: this.$t('approvals:status.rejected'), value: 'REJECTED' },
        { text: this.$t('approvals:status.draft'), value: 'DRAFT' },
        { text: this.$t('approvals:status.approved'), value: 'APPROVED' },
        { text: this.$t('approvals:status.all'), value: null }
      ]
    },
    canPublishDirect() {
      return _.intersection(this.permissions, ['publish:pages', 'manage:pages', 'manage:system']).length > 0
    },
    canEditSelected() {
      if (!this.detail) {
        return false
      }
      return _.intersection(this.permissions, ['write:pages', 'manage:pages', 'manage:system']).length > 0
    },
    hasQueue() {
      return this.queue.length > 0
    },
    pendingAvailable() {
      return _.get(this.detail, 'pendingVersion', null) !== null
    },
    activeVersion() {
      if (!this.detail) {
        return null
      }
      if (this.versionSelection === 'pending' && this.pendingAvailable) {
        return this.detail.pendingVersion
      }
      return this.detail.liveVersion
    },
    sanitizedRender() {
      if (!this.activeVersion || !this.activeVersion.render) {
        return '<em>No preview available.</em>'
      }
      return DOMPurify.sanitize(this.activeVersion.render, {
        ALLOWED_TAGS: ['a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'dd', 'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'],
        ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'target', 'rel']
      })
    },
    emptyStateBackground() {
      return this.$vuetify.theme.dark ? 'grey darken-4 white--text' : 'grey lighten-5'
    }
  },
  watch: {
    statusFilter() {
      this.refreshQueue()
    }
  },
  created() {
    this.$store.commit('page/SET_MODE', 'approvals')
    this.refreshQueue()
  },
  methods: {
    async refreshQueue() {
      this.queueLoading = true
      try {
        const variables = { status: this.statusFilter || null }
        const resp = await this.$apollo.query({
          query: approvalQueueQuery,
          variables,
          fetchPolicy: 'network-only'
        })
        const items = _.get(resp, 'data.pages.approvalQueue', [])
        this.queue = items

        const previouslySelected = this.selectedId
        const preservedItem = items.find(it => it.id === previouslySelected)
        if (preservedItem) {
          this.selectItem(preservedItem, { skipDetail: true })
          await this.loadDetail(preservedItem.id)
        } else if (items.length > 0) {
          this.selectItem(items[0], { skipDetail: true })
          await this.loadDetail(items[0].id)
        } else {
          this.selectedId = null
          this.selectedQueueItem = null
          this.detail = null
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.queueLoading = false
    },
    async loadDetail(id) {
      if (!id) {
        this.detail = null
        return
      }
      this.detailLoading = true
      try {
        const resp = await this.$apollo.query({
          query: approvalDetailQuery,
          variables: { id },
          fetchPolicy: 'network-only'
        })
        const detail = _.get(resp, 'data.pages.approvalDetail', null)
        this.detail = detail
        if (detail) {
          this.versionSelection = detail.pendingVersion ? 'pending' : 'live'
          this.contentView = 'render'
          this.comment = ''
          if (this.canPublishDirect) {
            const pendingPublished = _.get(detail, 'pendingVersion.isPublished')
            if (typeof pendingPublished === 'boolean') {
              this.publishOnApprove = pendingPublished
            } else {
              this.publishOnApprove = !!detail.currentIsPublished
            }
          } else {
            this.publishOnApprove = false
          }
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.detailLoading = false
    },
    selectItem(item, { skipDetail = false } = {}) {
      this.selectedId = item ? item.id : null
      this.selectedQueueItem = item || null
      if (!skipDetail && item) {
        this.loadDetail(item.id)
      }
    },
    async refreshDetail() {
      if (this.selectedId) {
        await this.loadDetail(this.selectedId)
      }
    },
    editSelected() {
      if (!this.detail) {
        return
      }
      const pendingId = _.get(this.detail, 'pendingVersion.versionId')
      const query = pendingId ? `?pendingVersion=${pendingId}` : ''
      const target = `/approvals/${this.detail.id}/edit${query}`
      window.open(target, '_blank', 'noopener')
    },
    async approveSelected() {
      if (!this.detail || this.actionLoading) {
        return
      }
      this.actionLoading = true
      try {
        const variables = {
          id: this.detail.id,
          comment: this.comment || null
        }
        if (this.canPublishDirect) {
          variables.publish = !!this.publishOnApprove
        }

        const resp = await this.$apollo.mutate({
          mutation: approvePageMutation,
          variables
        })
        const succeeded = _.get(resp, 'data.pages.approve.responseResult.succeeded', false)
        if (!succeeded) {
          throw new Error(_.get(resp, 'data.pages.approve.responseResult.message', 'Failed to approve changes.'))
        }
        this.$store.commit('showNotification', {
          message: 'Changes approved successfully.',
          style: 'success',
          icon: 'check'
        })
        this.comment = ''
        await this.refreshQueue()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.actionLoading = false
    },
    async rejectSelected() {
      if (!this.detail || this.actionLoading) {
        return
      }
      this.actionLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: rejectPageMutation,
          variables: {
            id: this.detail.id,
            comment: this.comment || null
          }
        })
        const succeeded = _.get(resp, 'data.pages.reject.responseResult.succeeded', false)
        if (!succeeded) {
          throw new Error(_.get(resp, 'data.pages.reject.responseResult.message', 'Failed to reject changes.'))
        }
        this.$store.commit('showNotification', {
          message: 'Changes rejected.',
          style: 'success',
          icon: 'alert'
        })
        this.comment = ''
        await this.refreshQueue()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.actionLoading = false
    },
    statusMeta(status) {
      const normalized = (status || '').toUpperCase()
      switch (normalized) {
        case 'PENDING':
          return { label: this.$t('approvals:status.pending'), chip: 'amber darken-2' }
        case 'REJECTED':
          return { label: this.$t('approvals:status.rejected'), chip: 'red darken-2' }
        case 'DRAFT':
          return { label: this.$t('approvals:status.draft'), chip: 'blue-grey darken-2' }
        case 'APPROVED':
          return { label: this.$t('approvals:status.approved'), chip: 'green darken-2' }
        default:
          return { label: _.startCase(normalized || 'Unknown'), chip: 'grey darken-1' }
      }
    }
  }
}
</script>

<style lang='scss'>
.approvals {
  .approvals-queue-item--active {
    background-color: rgba(33, 150, 243, 0.12);
  }

  .font-mono {
    font-family: 'Roboto Mono', monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .approvals-render {
    img {
      max-width: 100%;
      height: auto;
    }
  }

  .empty-queue-state {
    padding: 48px 24px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 560px;
    margin: 24px auto;
  }

  .approvals-toggle-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;

    .version-toggle,
    .content-toggle {
      flex: 1 1 220px;
      background: transparent;
      display: flex;
      justify-content: flex-start;
    }

    .content-toggle {
      margin-left: auto;
      justify-content: flex-end;
    }

    .v-btn-toggle {
      box-shadow: none;
    }
  }
}
</style>
