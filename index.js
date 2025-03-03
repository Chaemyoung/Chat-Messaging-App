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

app.post('/submitUser', async (req,res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (!username) {
        return res.redirect('/signup?error=Please provide a username');
    }
    if (!password) {
        return res.redirect('/signup?error=Please provide a password');
    }

    var hashedPassword = bcrypt.hashSync(password, saltRounds);

    try {
        var success = await db_users.createUser({ user: username, hashedPassword: hashedPassword });

        if (success) {
            req.session.authenticated = true;
            req.session.username = username;
            
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
        return res.redirect('/login?error=Please provide a username');
    }
    if (!password) {
        return res.redirect('/login?error=Please provide a password');
    }

    var results = await db_users.getUser({ user: username });

    if (results) {
        if (results.length == 1) {
            if (bcrypt.compareSync(password, results[0].password)) {
                req.session.authenticated = true;
                req.session.user_type = results[0].type;
                req.session.username = user.username;
                req.session.cookie.maxAge = expireTime;

                return res.redirect('/');
            }
            else {
                console.log('Invalid username or password');
                return res.redirect('/login?error=Invalid username or password');
            }
        } else {
            console.log('invalid number of users matched: ' + results.length + " (expected 1).");
            return res.redirect('/login?error=Invalid username or password');
        }
    }

    console.log('User not found');
    return res.redirect('/login?error=Invalid username or password');
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