<!-- TITLE: Page Approval Roles -->
<!-- SUBTITLE: Recommended groups and permissions for collaborative publishing -->

# Page approval workflow setup

This guide outlines a practical default role model for the approval workflow. It assumes that Wiki.js is already synchronising users into groups (internal or via SSO) and that page rules scope access to parts of the tree.

## Core groups

- **Authors**
  - Permissions: `read:pages`, `write:pages`
  - Page rules: grant write access to the sections they own (for example `/docs` or locale-specific segments)
  - Behaviour: Authors can create and edit pages, but all changes remain Pending Approval. They cannot publish directly.
- **Approvers**
  - Permissions: `read:pages`, `write:pages`, `approve:pages`, `publish:pages`
  - Optional: add `manage:pages` if they should move/rename content
  - Page rules: same scopes as their corresponding authors. Having `publish:pages` allows immediate publishing after approval. Remove that permission if policy requires a separate publisher.
- **Publishers** *(optional separation)*
  - Permissions: `publish:pages`, `manage:pages`
  - Intended for a final gate distinct from reviewers. Approvers mark changes as approved; publishers publish.
- **Site Editors**
  - Permissions: `read:pages`, `write:pages`, `manage:pages`, `approve:pages`, `publish:pages`, `delete:pages`
  - Scope: broad (often entire wiki) for the editorial team. Acts as catch-all moderation.
- **Site Admins**
  - Permissions: `manage:system` (implicitly includes all content permissions)
  - Audience: platform administrators only.

### Supporting groups

- **Contributors**
  - Permissions: `read:pages`
  - Use when occasional SMEs draft content outside the wiki and authors import it. They cannot edit directly without supervision.
- **Style Editors**
  - Extend Authors with `write:styles` and `write:scripts` for teams who manage custom CSS/JS on specific sections.

## Page rules checklist

1. Add rules under **Administration → Groups → Rules**.
2. Use `START` match for the top-level folder (`/product`, `/hr/policies`, etc.).
3. Assign permissions aligned with the group role (`write:pages` for authors; `approve:pages`, `publish:pages` for approvers/publishers).
4. Apply locale filters when running multi-language sites.
5. Stack deny rules to block edits to archived sections while keeping read access.

## Permission map

| Action | Required permission |
| --- | --- |
| Draft / submit for approval | `write:pages` |
| Approve / reject submissions | `approve:pages` |
| Publish without review | `publish:pages` |
| Move / rename | `manage:pages` |
| Delete | `delete:pages` |
| Inject CSS | `write:styles` |
| Inject JS | `write:scripts` |

## Suggested workflow

1. Authors save a page. Without `publish:pages` the editor switches to “Submit for Approval”; the change enters Pending status.
2. Moderators review submissions from the **Page Moderators workspace** (`/approvals`, also linked from the main toolbar) or, if they prefer, the Administration → Pages view. They can approve, reject, or leave reviewer comments.
3. When approvers also hold `publish:pages`, the page goes live immediately. Otherwise, Publishers perform the final publish step.
4. Rejections surface back to authors as a banner inside the editor along with the reviewer comment.
5. Git storage commits only on Approved state, ensuring the repository mirrors published content.

## Operational tips

- Keep group scopes narrow—multiple small groups are easier to audit than one global authoring group.
- Map SSO/LDAP roles to these Wiki.js groups to automate onboarding and offboarding.
- Schedule reminders (email/Slack) so approvers clear the pending queue regularly.
- When exposing public read access, restrict authoring groups to internal identity providers.

