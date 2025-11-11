module.exports.up = async (knex) => {
  const hasStatusColumn = await knex.schema.hasColumn('pages', 'approvalStatus')
  if (!hasStatusColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.string('approvalStatus').notNullable().defaultTo('approved')
      table.integer('pendingVersionId').unsigned()
      table.integer('approverId').unsigned()
      table.string('approvalComment', 1024).defaultTo('')
    })
  }

  const hasWorkflowStatus = await knex.schema.hasColumn('pageHistory', 'workflowStatus')
  const hasSourceVersion = await knex.schema.hasColumn('pageHistory', 'sourceVersionId')
  const hasExtra = await knex.schema.hasColumn('pageHistory', 'extra')

  if (!hasWorkflowStatus || !hasSourceVersion || !hasExtra) {
    await knex.schema.alterTable('pageHistory', (table) => {
      if (!hasWorkflowStatus) {
        table.string('workflowStatus').notNullable().defaultTo('history')
      }
      if (!hasSourceVersion) {
        table.integer('sourceVersionId').unsigned()
      }
      if (!hasExtra) {
        table.json('extra')
      }
    })
  }
}

module.exports.down = async (knex) => {
  const hasStatusColumn = await knex.schema.hasColumn('pages', 'approvalStatus')
  if (hasStatusColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.dropColumn('approvalStatus')
      table.dropColumn('pendingVersionId')
      table.dropColumn('approverId')
      table.dropColumn('approvalComment')
    })
  }

  const hasWorkflowStatus = await knex.schema.hasColumn('pageHistory', 'workflowStatus')
  const hasSourceVersion = await knex.schema.hasColumn('pageHistory', 'sourceVersionId')
  const hasExtra = await knex.schema.hasColumn('pageHistory', 'extra')
  if (hasWorkflowStatus || hasSourceVersion || hasExtra) {
    await knex.schema.alterTable('pageHistory', (table) => {
      if (hasWorkflowStatus) {
        table.dropColumn('workflowStatus')
      }
      if (hasSourceVersion) {
        table.dropColumn('sourceVersionId')
      }
      if (hasExtra) {
        table.dropColumn('extra')
      }
    })
  }
}
