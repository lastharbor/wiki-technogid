module.exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable('pageFolders')
  if (!hasTable) {
    await knex.schema.createTable('pageFolders', (table) => {
      table.increments('id').primary()
      table.string('localeCode', 10).notNullable()
      table.string('path', 255).notNullable()
      table.string('title', 255).notNullable()
      table.timestamps(true, true)
      table.unique(['localeCode', 'path'])
    })
  }
}

module.exports.down = async (knex) => {
  const hasTable = await knex.schema.hasTable('pageFolders')
  if (hasTable) {
    await knex.schema.dropTable('pageFolders')
  }
}
