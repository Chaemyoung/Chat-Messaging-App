const express = require('express');
const app = express();

const port = process.env.PORT || 4001;

require('./utils');
require('dotenv').config();

const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 12;


app.set('view engine', 'ejs');
app.set('views', './views/templates');

app.use(express.static(__dirname + "/public"));

const db_users = include('database/members');
const db_messages = include('database/messages');

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const mongodb_database_name = process.env.MONGODB_DATABASE_NAME;
const sessionSecret = process.env.SESSION_SECRET;

const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({extended: false}));

const expireTime = 1 * 60 * 60 * 1000; // expires after 1 hour (hours * minutes * seconds * millis)

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.rvu8q.mongodb.net/${mongodb_database_name}`,
    crypto: {
      secret: mongodb_session_secret,
    },
    ttl: 3600,  // Session expiration in seconds (1 hour = 3600 seconds)
    autoRemove: 'native', 
  });

app.use(session({ 
        secret: sessionSecret,
        store: mongoStore,
        saveUninitialized: false, 
        resave: true
    }
));


app.get('/', (req, res) => {
    const username = req.session.username || null; 
    res.render('home', { username });
});


function validatePassword(password) {
    const minLength = 10;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password);

    if (password.length < minLength) {
        return "Password must be at least 10 characters long";
    }
    if (!hasUpperCase) {
        return "Password must contain at least one uppercase letter";
    }
    if (!hasLowerCase) {
        return "Password must contain at least one lowercase letter";
    }
    if (!hasNumbers) {
        return "Password must contain at least one number";
    }
    if (!hasSpecialChar) {
        return "Password must contain at least one special character";
    }
    return null; // Returns null if password meets all requirements
}


app.get('/signup', (req, res) => {
    const errorMessage = req.query.error || '';
    res.render('signup', { errorMessage });
});

app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;

    // Validation
    if (!username) {
        return res.redirect('/signup?error=Please provide a username');
    }
    if (!password) {
        return res.redirect('/signup?error=Please provide a password');
    }
    // Check password requirements
    const passwordError = validatePassword(password);
    if (passwordError) {
        return res.redirect(`/signup?error=${encodeURIComponent(passwordError)}`);
    }
    if (!email) {
        return res.redirect('/signup?error=Please provide an email');
    }
    if (!email.includes('@') || !email.includes('.')) {
        return res.redirect('/signup?error=Please provide a valid email');
    }

    var hashedPassword = bcrypt.hashSync(password, saltRounds);

    try {
        // Check if username already exists
        const existingUsername = await db_users.getUser({ user: username });
        if (existingUsername && existingUsername.length > 0) {
            return res.redirect('/signup?error=Username already in use');
        }

        // Check if email already exists
        const existingEmail = await db_users.getUserByEmail({ email: email });
        if (existingEmail && existingEmail.length > 0) {
            return res.redirect('/signup?error=Email already in use');
        }

        // Create new user if no conflicts
        var userId = await db_users.createUser({ 
            user: username, 
            hashedPassword: hashedPassword,
            email: email 
        });

        if (userId) {
            req.session.authenticated = true;
            req.session.username = username;
            req.session.user_id = userId;
            req.session.email = email;
            
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/signup?error=Session error occurred');
                }
                return res.redirect('/groups');
            });
        } else {
            return res.redirect('/signup?error=Sign Up failed');
        }
    } catch (error) {
        console.error('Error during user creation:', error);
        return res.redirect('/signup?error=An unexpected error occurred');
    }
});

app.get('/members', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const images = ['/cat1.png', '/cat2.png', '/cat3.png'];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.render('members', { 
        username: req.session.username, 
        imagePath: randomImage 
    });
});


app.get('/login', (req, res) => {
    const errorMessage = req.query.error || null;
    res.render('login', { errorMessage });
});



app.post('/loggingin', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (!username) {
        return res.redirect('/login?error=Please provide a username or email');
    }
    if (!password) {
        return res.redirect('/login?error=Please provide a password');
    }

    // Try to find user by username OR email
    var results = await db_users.getUser({ user: username });
    if (!results || results.length === 0) {
        results = await db_users.getUserByEmail({ email: username });
    }

    if (results && results.length === 1) {
        if (bcrypt.compareSync(password, results[0].password)) {
            req.session.authenticated = true;
            req.session.user_type = results[0].type;
            req.session.username = results[0].username;
            req.session.email = results[0].email;
            req.session.user_id = results[0].user_id;
            req.session.cookie.maxAge = expireTime;
            return res.redirect('/groups');
        } else {
            console.log('Invalid credentials');
            return res.redirect('/login?error=Invalid username/email or password');
        }
    } else {
        console.log('User not found or multiple users matched');
        return res.redirect('/login?error=Invalid username/email or password');
    }
});


function isValidSession(req) {
    return req.session && req.session.authenticated;
}

function sessionValidation(req, res, next) {
    if (!isValidSession(req)) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
            res.redirect('/login');
        });
    } else {
        next();
    }
}

app.get('/groups', sessionValidation, async (req, res) => {
    const userId = req.session.user_id;
    try {
        const rooms = await db_users.getRoomsForUser(userId);
        res.render('groups', { 
            username: req.session.username, 
            rooms: rooms, 
            error: null,
            userId: userId
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.render('groups', { 
            username: req.session.username, 
            rooms: [], 
            error: 'An error occurred while fetching your groups',
            userId: userId
        });
    }
});

app.get('/api/messages/:room_id', sessionValidation, async (req, res) => {
    const roomId = req.params.room_id;
    const userId = req.session.user_id;

    try {
        const messages = await db_messages.getMessagesForRoom(roomId);
        res.json({ messages });
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

app.use(express.json());

app.post('/api/messages', sessionValidation, async (req, res) => {
    const { roomId, text } = req.body;
    const userId = req.session.user_id;
    if (!roomId || !text) {
        return res.status(400).json({ error: 'Missing roomId or text' });
    }
    try {
        const messageId = await db_messages.sendMessage({ userId, roomId, text });

        const sent_datetime = new Date();
        res.json({ success: true, messageId, text, sent_datetime });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/clearUnread', sessionValidation, async (req, res) => {
    const { roomId } = req.body;
    const userId = req.session.user_id;
    if (!roomId) {
        return res.status(400).json({ error: 'Missing roomId' });
    }
    try {
        await db_messages.clearUnread({ roomId, userId });
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing unread messages:', error);
        res.status(500).json({ error: 'Failed to clear unread messages' });
    }
});

app.get('/api/users', sessionValidation, async (req, res) => {
    try {
        const users = await db_users.getAllUsers();
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/createGroup', sessionValidation, async (req, res) => {
    const { groupName, invitedUserIds } = req.body;
    if (!groupName || !invitedUserIds || !Array.isArray(invitedUserIds)) {
        return res.status(400).json({ error: 'Invalid data provided' });
    }
    try {
        const newRoomId = await db_users.createGroup({ groupName, invitedUserIds });
        res.json({ success: true, roomId: newRoomId });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});


app.use('/members', sessionValidation);

app.get('/members', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const images = ['/cat1.png', '/cat2.png', '/cat3.png'];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.render('members', { 
        username: req.session.username, 
        imagePath: randomImage 
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => { 
        if (err) {
            return res.redirect('/'); 
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('*', (req, res) => {
    res.status(404).render('404');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/`);
});