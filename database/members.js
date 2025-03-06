const database = include('databaseConnection');

async function createUser(postData) {
	let createUserSQL = `
	INSERT INTO user
	(email, username, password, profile_img)
	VALUES
	(:email, :user, :passwordHash, null);
`;

	let params = {
		email: postData.email,
		user: postData.user,
		passwordHash: postData.hashedPassword
	}
	
	try {
		const results = await database.query(createUserSQL, params);

        console.log("Successfully created user");
		console.log(results[0]);
		return results[0].insertId;
	}
	catch(err) {
		console.log("Error inserting user");
        console.log(err);
		return false;
	}
}

async function getUsers(postData) {
	let getUsersSQL = `
		SELECT email, username, password
		FROM user;
	`;
	
	try {
		const results = await database.query(getUsersSQL);

        console.log("Successfully retrieved users");
		console.log(results[0]);
		return results[0];
	}
	catch(err) {
		console.log("Error getting users");
        console.log(err);
		return false;
	}
}

async function getUser(postData) {
	let getUserSQL = `
		SELECT *
		FROM user
		WHERE username = :user;
	`;

	let params = {
		user: postData.user
	}
	
	try {
		const results = await database.query(getUserSQL, params);

        console.log("Successfully found user");
		console.log(results[0]);
		return results[0];
	}
	catch(err) {
		console.log("Error trying to find user");
        console.log(err);
		return false;
	}
}

async function getUserByEmail(postData) {
    let getUserEmailSQL = `
        SELECT *
        FROM user
        WHERE email = :email;
    `;

    let params = {
        email: postData.email
    }
    
    try {
        const results = await database.query(getUserEmailSQL, params);
        console.log("Successfully found user by email");
        console.log(results[0]);
        return results[0];
    }
    catch(err) {
        console.log("Error trying to find user by email");
        console.log(err);
        return false;
    }
}


async function getRoomsForUser(userId) {
    let getRoomsSQL = `
        SELECT r.room_id, r.name, r.start_datetime
        FROM room r
        JOIN room_user ru ON r.room_id = ru.room_id
        WHERE ru.user_id = :userId
        ORDER BY r.start_datetime DESC;
    `;

    let params = {
        userId: userId
    };
    
    try {
        const results = await database.query(getRoomsSQL, params);
        console.log("Successfully retrieved rooms for user");
        console.log(results[0]);
        return results[0]; // Array of rooms
    } catch (err) {
        console.log("Error retrieving rooms for user");
        console.log(err);
        return false;
    }
}

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

module.exports = { createUser, getUsers, getUser, getUserByEmail, getRoomsForUser, getMessagesForRoom, getLastReadMsg };