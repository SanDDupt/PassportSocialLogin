require("dotenv").config();

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const express = require("express");
const favicon = require("serve-favicon");
const hbs = require("hbs");
const mongoose = require("mongoose");
const logger = require("morgan");
const path = require("path");

const session = require("express-session");
const bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash");

const SlackStrategy = require("passport-slack").Strategy;
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

// Require user model
const User = require("./models/user");

// Connection base de données
mongoose
  .connect(
    "mongodb://localhost/passportsignuplogin",
    { useNewUrlParser: true }
  )
  .then(x => {
    console.log(
      `Connected to Mongo! Database name: "${x.connections[0].name}"`
    );
  })
  .catch(err => {
    console.error("Error connecting to mongo", err);
  });

const app_name = require("./package.json").name;
const debug = require("debug")(
  `${app_name}:${path.basename(__filename).split(".")[0]}`
);

const app = express();

// MIDDLEWARE SETUP
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  session({
    secret: "our-passport-local-strategy-app",
    resave: true,
    saveUninitialized: true
  })
);

// Serialize et deserialize
passport.serializeUser((user, cb) => {
  cb(null, user._id);
});
passport.deserializeUser((id, cb) => {
  User.findById(id, (err, user) => {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});

app.use(passport.initialize());
app.use(passport.session());

// Messages d'erreur flash
app.use(flash());
passport.use(
  new LocalStrategy(
    {
      passReqToCallback: true
    },
    (req, username, password, next) => {
      User.findOne({ username }, (err, user) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return next(null, false, { message: "Incorrect username" });
        }
        if (!bcrypt.compareSync(password, user.password)) {
          return next(null, false, { message: "Incorrect password" });
        }

        return next(null, user);
      });
    }
  )
);

// Slack
passport.use(
  new SlackStrategy(
    {
      clientID: "2432150752.520234749733",
      clientSecret: "d6c66ad9ecc51f54894c203f96d1ecf9"
    },
    (accessToken, refreshToken, profile, done) => {
      User.findOne({ slackID: profile.id })
        .then(user => {
          // if (err) {
          //   return done(err);
          // }
          if (user) {
            return done(null, user);
          }
          const newUser = new User({
            slackID: profile.id
          });
          newUser.save().then(user => {
            done(null, newUser);
          });
        })
        .catch(error => {
          //next(error); 
          console.error(error);
        });
    }
  )
);

// GOOGLE
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID:
//         "1017804540862-kpjh2m05s9v1dcu5qa74ovseut7i7c2d.apps.googleusercontent.com",
//       clientSecret: "XxG_ObZ5dU74DLHwFxtspWFx",
//       callbackURL: "/auth/google/callback"
//     },
//     (accessToken, refreshToken, profile, done) => {
//       User.findOne({ googleID: profile.id })
//         .then(user => {
//           if (user) {
//             return done(null, user);
//           }

//           const newUser = new User({
//             googleID: profile.id
//           });

//           newUser.save().then(user => {
//             done(null, newUser);
//           });
//         })
//         .catch(error => {
//           console.error(error);
//         });
//     }
//   )
// );

// Express View engine setup
app.use(
  require("node-sass-middleware")({
    src: path.join(__dirname, "public"),
    dest: path.join(__dirname, "public"),
    sourceMap: true
  })
);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.use(express.static(path.join(__dirname, "public")));
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));

// default value for title local
app.locals.title = "Express - Generated with IronGenerator";

// Routes
const authRoutes = require("./routes/auth-routes");
app.use("/", authRoutes);

const index = require("./routes/index");
app.use("/", index);

module.exports = app;
