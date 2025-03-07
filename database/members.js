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
        SELECT r.room_id, r.name, r.start_datetime, ru.last_read_msg,
               COALESCE(
                 (SELECT MAX(m.message_id)
                  FROM message m
                  JOIN room_user ru2 ON m.room_user_id = ru2.room_user_id
                  WHERE ru2.room_id = r.room_id
                 ), 0
               ) AS latest_msg_id,
               GREATEST(
                   COALESCE(
                       (SELECT MAX(m.message_id)
                        FROM message m
                        JOIN room_user ru2 ON m.room_user_id = ru2.room_user_id
                        WHERE ru2.room_id = r.room_id
                       ), 0
                   ) - IFNULL(ru.last_read_msg, 0), 0
               ) AS unread_count
        FROM room r
        JOIN room_user ru ON r.room_id = ru.room_id
        WHERE ru.user_id = :userId
        ORDER BY r.start_datetime DESC;
    `;
    let params = { userId };
    try {
        const results = await database.query(getRoomsSQL, params);
        console.log("Successfully retrieved rooms for user");
        console.log(results[0]);
        return results[0];
    } catch (err) {
        console.log("Error retrieving rooms for user");
        console.log(err);
        return false;
    }
}

async function getAllUsers() {
    const getUsersSQL = `
        SELECT user_id, username, email, profile_img
        FROM user;
    `;
    try {
        const results = await database.query(getUsersSQL);
        return results[0];
    } catch (err) {
        console.error("Error getting users");
        console.error(err);
        return [];
    }
}

async function createGroup({ groupName, invitedUserIds }) {
    // Insert new group into the room table
    const insertRoomSQL = `
        INSERT INTO room (name, start_datetime)
        VALUES (:groupName, NOW());
    `;
    const roomParams = { groupName };
    const roomResult = await database.query(insertRoomSQL, roomParams);
    const newRoomId = roomResult[0].insertId;

    // Insert rows into room_user table for each invited user
    const insertRoomUserSQL = `
        INSERT INTO room_user (room_id, user_id, last_read_msg)
        VALUES (:roomId, :userId, 0);
    `;
    // Use Promise.all to insert all users concurrently
    const insertPromises = invitedUserIds.map(userId => {
        const params = { roomId: newRoomId, userId };
        return database.query(insertRoomUserSQL, params);
    });
    await Promise.all(insertPromises);

    return newRoomId;
}


module.exports = { createUser, getUsers, getUser, getUserByEmail, getRoomsForUser, getAllUsers, createGroup };