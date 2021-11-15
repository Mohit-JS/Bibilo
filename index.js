//INT 221 Final Project

const LocalStrategy = require('passport-local').Strategy;

const bcrypt = require('bcrypt');

const express = require('express'); // we started with express to use http verbs and view engine(ejs)
app = express();

app.use(express.static(__dirname + '/Public')); // This will help us to fetch static files like images ans styles

app.set('view engine', 'ejs'); //With this we are initiating our Template engine and we can use it in our driver file now.

// They will help us with form data reading after user submits it
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
    extended: true
}));

//Mongoose will help us to write shorter version of mongodb code snippets
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/test');

//passportjs extensions:
const passport = require('passport'); // Authenticator extension
const session = require('express-session'); // Session ID is saved in cookie using this
const passportLocalMongoose = require('passport-local-mongoose'); //simplifies login/signup with mongoose

const userDataSchema = new mongoose.Schema({
    email: String,
    username: String,
    cartItems: [{
        name: String,
        qty: {
            type: Number,
            default: 0
        }
    }]
})

const userData = mongoose.model('userData', userDataSchema);

const products = new mongoose.Schema({
    image: String,
    name: String,
    author: String,
    rating: Number,
    price: Number
})


const productData = mongoose.model('productData', products);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    isAdmin: Boolean
})

userSchema.plugin(passportLocalMongoose);

const userCredentials = mongoose.model('userCredentials', userSchema);

// Cookie initialised
app.use(session({
    secret: "cats",
    resave: false,
    saveUninitialized: false
}));

//Passport initialization with session
app.use(passport.initialize());
app.use(passport.session());


// A model (a folder basically) where we store our data in the database

// To Configure our mkongoDB credentials with passport authentication
// Taken from passport-local-mongoose npm page
passport.use(userCredentials.createStrategy());

//uses the session to fetch the user data and stores as an ID in the cookie
passport.serializeUser(userCredentials.serializeUser());

// Reads teh user ID and authenticates them to proceed
passport.deserializeUser(userCredentials.deserializeUser());



//login route handle


//signup route handle
app.get("/signup", (req, res) => {
    res.render("signup", {
        message: ""
    });
})

//landing route with authorization check
app.get("/landing", (req, res) => {

    productData.find({}, (err, foundItems) => {

        const books = foundItems;
        if (req.isAuthenticated()) {
            const name = req.user.username;

            userData.findOne({
                email: name
            }, (err, foundItem) => {
                const userDisplayName = foundItem.username;
                res.render("landing", {
                    name: userDisplayName,
                    products: books
                });
            })

        } else {
            res.render("login", {
                message: "you need to log in first"
            });
        }

    });
});

//logout with session end
app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});

app.get("/cart", (req, res) => {
    if (req.isAuthenticated()) {
        const findcartdata = req.user.username;

        userData.findOne({
            email: findcartdata
        }, async function (err, BookId) {
            // console.log(BookId.cartItemId);

            const idArray = BookId.cartItems;
            var bookArray = [];
            for (const data of idArray) {
                const foundBookData = await productData.findOne({
                    _id: data.name
                }).catch(console.error);
                if (!foundBookData) {
                    continue
                };

                bookArray.push(foundBookData);
                
                var f = BookId.cartItems;
            }

            res.render("cart", {
                cartBookArray: bookArray,
                cartQty: f
            })
        });
    } else {
        res.redirect("/login");
    }
})

app.get('/adminpanel', (req, res) => {

    productData.find((err, booklist) => {


        if (req.isAuthenticated() && req.user.isAdmin) {
            res.render("admin", {
                bookList: booklist
            });
        } else {
            res.redirect('login')
        }
    });
});

app.post('/addtocart/:id', (req, res) => {
    const bookid = req.params.id;

    if (req.isAuthenticated()) {
        const currentusername = req.user.username;
        userData.findOne({
            email: currentusername
        }, async (err, foundStuff) => {
            var kaamKaArray = foundStuff.cartItems;
            if (err) {
                console.log(err);
            } else {
                var shortCut = kaamKaArray.find(val => val.name === bookid)
                if(shortCut){
                    shortCut.qty += 1
                    foundStuff.save();
                }
                else{
                    var data = {
                        name: bookid,
                        qty: 1
                    };
                    kaamKaArray.push(data);
                    foundStuff.save();
                }                             
            }
            res.redirect('/cart');
        });
    } else {
        res.redirect("/cart");
    }
})

app.post('/adminpanel', (req, res) => {
    const newBook = new productData({
        image: req.body.imagelink,
        name: req.body.bookname,
        author: req.body.author,
        rating: req.body.rating
    });

    newBook.save();
    res.redirect('/adminpanel')
})

app.post('/delete', (req, res) => {
    const checkedItem = req.body.checkbox;
    productData.findByIdAndRemove(checkedItem, (err) => {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/adminpanel")
        }
    })
})

//Signup post method with registering the credientials in db using passport
app.post('/signup', (req, res) => {

    var a = req.body.password;
    var b = req.body.cpassword;

    if (a != b) {
        res.render("signup", {
            message: "Passwords do not match"
        });
        return false;
    }

    // saves the email and name in another DB schema which contains personal info of 
    // user
    const human = new userData({
        email: req.body.username,
        username: req.body.name
    });

    human.save();

    userCredentials.register({
        username: req.body.username,
        isAdmin: false
    }, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect('/signup');
        } else {
            passport.authenticate("local")(req, res, (err, user, info) => {
                res.redirect("/landing");
            });
        }
    });
});

app.get("/login", (req, res) => {
    res.render("login", {
        message: ""
    });
})

app.post('/login', (req, res) => {
    userCredentials.findOne({
        username: req.body.username
    }, function (err, foundUser) {
        if (foundUser) {
            const user = new userCredentials({
                username: req.body.username,
                password: req.body.password
            });
            passport.authenticate("local", function (err, user) {
                if (err) {
                    console.log(err);
                } else {
                    if (user) {

                        req.login(user, function (err) {
                            res.redirect("/landing");
                        });
                    } else {
                        res.render("login", {
                            message: "Error"
                        });
                    }
                }
            })(req, res);
        } else {
            res.render("login", {
                message: "Error"
            })
        }
    });
})

app.get('/', (req, res) => {
    res.render('login', {
        message: ""
    });
});

//Listens to my requests and implement responses on server with the given port no.
app.listen(3000 || process.env.PORT, () => {
    console.log("started at 3000");
});