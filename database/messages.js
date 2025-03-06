const database = include('databaseConnection');

async function getMessagesForRoom(roomId) {
    const sql = `
        SELECT m.message_id, m.text, m.sent_datetime, u.user_id, u.username, u.profile_img
        FROM message m
        JOIN room_user ru ON m.room_user_id = ru.room_user_id
        JOIN user u ON ru.user_id = u.user_id
        WHERE ru.room_id = :roomId
        ORDER BY m.sent_datetime ASC;
    `;
    const params = { roomId };
    try {
        const results = await database.query(sql, params);
        console.log(`Successfully fetched messages for room ${roomId}`);
        return results[0]; 
    } catch (err) {
        console.error(`Error fetching messages for room ${roomId}:`, err);
        throw err;
    }
}

async function getLastReadMsg(userId, roomId) {
    const sql = `
        SELECT last_read_msg
        FROM room_user
        WHERE user_id = :userId AND room_id = :roomId;
    `;
    const params = { userId, roomId };
    const results = await database.query(sql, params);
    return results[0][0]?.last_read_msg || null;
}

module.exports = { getMessagesForRoom, getLastReadMsg };