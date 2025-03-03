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
        var success = await db_users.createUser({ 
            user: username, 
            hashedPassword: hashedPassword,
            email: email 
        });

        if (success) {
            req.session.authenticated = true;
            req.session.username = username;
            req.session.email = email;
            
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.redirect('/signup?error=Session error occurred');
                }
                return res.redirect('/members');
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
            req.session.cookie.maxAge = expireTime;

            return res.redirect('/');
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