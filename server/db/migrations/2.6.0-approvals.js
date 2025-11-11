module.exports.up = async (knex) => {
  const hasStatusColumn = await knex.schema.hasColumn('pages', 'approvalStatus')
  if (!hasStatusColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.string('approvalStatus').notNullable().defaultTo('approved')
      table.integer('pendingVersionId').unsigned().references('id').inTable('pageHistory').onDelete('SET NULL')
      table.integer('approverId').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('approvalComment', 1024).defaultTo('')
    })
  }

  const hasWorkflowColumnHistory = await knex.schema.hasColumn('pageHistory', 'workflowStatus')
  if (!hasWorkflowColumnHistory) {
    await knex.schema.alterTable('pageHistory', (table) => {
      table.string('workflowStatus').notNullable().defaultTo('history')
      table.integer('sourceVersionId').unsigned().references('id').inTable('pageHistory').onDelete('SET NULL')
      table.json('extra')
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

  const hasWorkflowColumnHistory = await knex.schema.hasColumn('pageHistory', 'workflowStatus')
  if (hasWorkflowColumnHistory) {
    await knex.schema.alterTable('pageHistory', (table) => {
      table.dropColumn('workflowStatus')
      table.dropColumn('sourceVersionId')
      table.dropColumn('extra')
    })
  }
}
