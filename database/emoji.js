const database = include('databaseConnection');

async function getAllEmojis() {
    try {
        const result = await database.query(
            `SELECT emoji_id, name, image FROM emoji ORDER BY emoji_id`
        );
        return result[0] || [];
    } catch (error) {
        console.error('Database error in getAllEmojis:', error);
        throw error;
    }
}

module.exports = { getAllEmojis };
