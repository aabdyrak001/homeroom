var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var mongoose = require("mongoose");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");

mongoose.connect("mongodb://localhost:27017/homeroom", {
				 useNewUrlParser: true,
				 useUnifiedTopology: true
})
	.then(()=> console.log("connected"))
	.catch(error => console.log(error.message))

app.set("view engine" , "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));

// =====MODEL Config==========
var lessonSchema = new mongoose.Schema({
	name: String, 
	image: String,
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
		username: String
	},
	topic: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Topic"
		}
	]
})
var Lesson = mongoose.model("Lesson", lessonSchema);

var topicSchema = new mongoose.Schema({
	name: String, 
	url: String,
	homework: String,
	classwork: String,
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
	username: String,
	}
});
var Topic = mongoose.model("Topic", topicSchema);

var UserSchema = new mongoose.Schema({
	username: String,
	password: String
})
UserSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", UserSchema);

// =====Passport Config================
app.use(require("express-session")({
	secret: "Lorem Study",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req,res, next){
	res.locals.currentUser = req.user;
	next();
})

// =======Routes===========

// --------landing-----------

app.get("/", function(req,res){
	res.render("landing");
});

// --------lessons-----------

app.get("/lessons", function(req, res){
	Lesson.find({}, function(err, lessons){
		if(err){
			console.log("Error")
		}else{
			res.render("lessons", {lessons: lessons})
		}
	});
});

// --------Lessons DB---------------

app.get("/lessons/new", isLoggedIn, function(req,res){
	res.render("new");
})
// --------CREATE---------------
app.post("/lessons", function(req,res){
	Lesson.create(req.body.lesson, function(err, newLesson){
		if(err){
			res.render("new")
		}else{
			res.redirect("/lessons")
		}
	})
})
// --------SHOW ROUTE---------------

app.get("/lessons/:id", isLoggedIn,  function(req,res){
	Lesson.findById(req.params.id).populate("topic").exec(function(err, foundlesson){
		if(err){
			res.redirect("/lessons")
		}else{
			res.render("show", {lesson: foundlesson});
		}
	})
})


// --------CREATE TOPICS Within Lesson------------
app.get("/lessons/:id/topics/new", function(req,res){
	Lesson.findById(req.params.id, function(err, lesson){
		if(err){
			console.log(err);
		}else{
			res.render("topic", {lesson: lesson});
		}
	})
})

app.post("/lessons/:id/topics", function(req, res){
	Lesson.findById(req.params.id, function(err, lesson){
		if(err){
			res.redirect("/lessons")
		}else{
			Topic.create(req.body.topic, function(err, topic){
				if(err){
					console.log(err)
				}else{
					lesson.topic.push(topic);
					lesson.save();
					res.redirect("/lessons/" + lesson._id);
				}
			})
		}
	})
})


// --------EDIT TOPICS------------

app.get("/lessons/:id/topics/:topic_id/edit", function(req, res){
	Topic.findById(req.params.topic_id, function(err,foundTopic){
		if(err){
			res.redirect("back")
		}else{
			res.render("edit", {lesson_id: req.params.id, topic: foundTopic});
		}
	});
})
// ----------UPDATE-------------------
app.put("/lessons/:id/topics/:topic_id", function(req,res){
	Topic.findByIdAndUpdate(req.params.topic_id, req.body.topic, function(err, updatedTopic){
		if(err){
			res.redirect("back")
		}else{
			res.redirect("/lessons/" + req.params.id)
		}
	})
})

// --------DELETE--------------------
app.delete("/lessons/:id/topics/:topic_id", function(req,res){
	Topic.findByIdAndRemove(req.params.topic_id, function(err){
		if(err){
			res.redirect("back")
		}else{
			res.redirect("/lessons/" + req.params.id)
		}
	})
})

// --------SHOW Chapter-----------------
app.get("/lessons/:id/topics/:topic_id/chapter", function(req,res){	
	Topic.findById(req.params.topic_id, function(err, foundTopic){
		if(err){
			console.log(err)
		}else{
			res.render('chapter', {lesson_id: req.params.id, topic: foundTopic})
		}
})
})
		

// =====AUTH ROUTES=============
app.get("/register", function(req, res){
	res.render("register")
})

// ------SignUP--------
app.post("/register", function(req, res){
	var newUser = new User({username: req.body.username});
	User.register(newUser, req.body.password, function(err, user){
		if(err){
			return res.render("register")
		}
		passport.authenticate("local")(req, res, function(){
			res.redirect("/lessons")
		});
	});
});

// ------LOGIN/LOGOUT---------
app.get("/login", function(req,res){
	res.render("login")
})

app.post("/login", passport.authenticate("local",{
	successRedirect: "/lessons/:id", 
	failureRedirect: "login"
}), function(req,res){
});

app.get("/logout", function(req, res){
	req.logout();
	res.redirect("/")
})

//-------------middleware-------------

// -------------CheckTopicOwnership-------------
// function checkTopicOwnership(req,res, next){
// 	if(req.isAuthenticated()){
// 		Topic.findById(req.params.topic_id, function(err, foundTopic){
// 			if(err){
// 				res.redirect("back")
// 			}else{
// 				console.log(foundTopic)
// 				console.log(foundTopic.author.id)
// 				console.log(req.user._id)
// 				if(foundTopic.author.id.equals(req.user._id)){
// 					next();
// 				}else{
// 					res.redirect("back");
// 				}
// 			}
			
// 		});
// 	}else{
// 	res.redirect("back")
// }
// }

function isLoggedIn(req,res, next){
	if(req.isAuthenticated()){
		return next();
} res.redirect("/login")
}

app.listen(3000, process.env.IP, function(){
	console.log("App started");
})