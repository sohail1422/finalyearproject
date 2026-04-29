const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const fs = require("fs");

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "enrichment-secret",
  resave: false,
  saveUninitialized: true
}));

function readJsonFile(path, fallback) {
  try {
    const data = fs.readFileSync(path, "utf8");
    return data ? JSON.parse(data) : fallback;
  } catch (err) {
    return fallback;
  }
}

let users = readJsonFile("users.json", []);
let achievements = readJsonFile("achievements.json", []);

// Badge assignment function
function badgeTierInfo(userAchievementsCount) {
  if(userAchievementsCount >= 10) return { badge: "/badges/gold.png", tier: "Gold", nextTier: null, nextCount: null };
  if(userAchievementsCount >= 5) return { badge: "/badges/silver.png", tier: "Silver", nextTier: "Gold", nextCount: 10 };
  return { badge: "/badges/bronze.png", tier: "Bronze", nextTier: "Silver", nextCount: 5 };
}

function badgeProgress(userAchievementsCount) {
  const info = badgeTierInfo(userAchievementsCount);
  if (!info.nextCount) return 1;
  return Math.min(1, userAchievementsCount / info.nextCount);
}

// Routes
app.get("/", (req, res) => res.render("home"));

app.get("/debug-routes", (req, res) => {
  res.json({
    message: "Route check",
    profileRoute: !!app._router.stack.find(r => r.route && r.route.path === '/profile'),
    leaderboardRoute: !!app._router.stack.find(r => r.route && r.route.path === '/leaderboard')
  });
});

app.get("/login", (req, res) => res.render("login", { message: "" }));

app.get("/register", (req, res) => res.render("register", { message: "" }));

app.post("/register", (req, res) => {
  console.log("Register attempt", req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render("register", { message: "Username and password are required" });
  }

  if (users.some(u => u.username === username)) {
    return res.render("register", { message: "User already exists" });
  }

  const newUser = { username, password };
  users.push(newUser);
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
  console.log("User registered", username);
  req.session.user = username;
  res.redirect("/dashboard");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if(user) {
    req.session.user = user.username;
    res.redirect("/dashboard");
  } else {
    res.render("login", { message: "Invalid credentials" });
  }
});

app.get("/dashboard", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  const userAchievements = achievements.filter(a => a.user === req.session.user);

  const tierInfo = badgeTierInfo(userAchievements.length);
  const progress = badgeProgress(userAchievements.length);

  res.render("dashboard", {
    username: req.session.user,
    achievements: userAchievements,
    overallBadge: tierInfo.badge,
    currentTier: tierInfo.tier,
    nextTier: tierInfo.nextTier,
    nextCount: tierInfo.nextCount,
    progress
  });
});

app.get("/profile", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  const userAchievements = achievements.filter(a => a.user === req.session.user);
  const tierInfo = badgeTierInfo(userAchievements.length);

  const firstAchievement = userAchievements[0];
  const now = new Date();
  let startDate = now;
  if (firstAchievement && firstAchievement.createdAt) {
    const candidate = new Date(firstAchievement.createdAt);
    if (!isNaN(candidate.valueOf())) {
      startDate = candidate;
    }
  }

  const daysSpan = Math.max(1, Math.round((now - startDate) / (1000 * 60 * 60 * 24)));
  const weeksSpan = Math.max(1, daysSpan / 7);
  const averagePerWeek = (userAchievements.length / weeksSpan).toFixed(2);

  const userRecord = users.find(u => u.username === req.session.user) || {};

  res.render("profile", {
    username: req.session.user,
    email: userRecord.email || "",
    bio: userRecord.bio || "",
    avatar: userRecord.avatar || "/badges/bronze.png",
    achievementCount: userAchievements.length,
    tierInfo,
    achievements: userAchievements,
    averagePerWeek
  });
});

app.get("/profile/edit", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  const userRecord = users.find(u => u.username === req.session.user) || {};
  res.render("editProfile", {
    username: req.session.user,
    email: userRecord.email || "",
    bio: userRecord.bio || "",
    avatar: userRecord.avatar || ""
  });
});

app.post("/profile/edit", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  const { email, bio, avatar } = req.body;

  const userIndex = users.findIndex(u => u.username === req.session.user);
  if (userIndex !== -1) {
    users[userIndex].email = email || "";
    users[userIndex].bio = bio || "";
    users[userIndex].avatar = avatar || "";
    fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
  }

  res.redirect("/profile");
});

app.get("/leaderboard", (req, res) => {
  const ranking = users.map(u => {
    const count = achievements.filter(a => a.user === u.username).length;
    const tierInfo = badgeTierInfo(count);
    return { username: u.username, count, tier: tierInfo.tier, badge: tierInfo.badge };
  }).sort((a, b) => b.count - a.count);

  res.render("leaderboard", { ranking });
});

app.get("/add", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  res.render("addAchievement");
});

app.post("/add", (req, res) => {
  if(!req.session.user) return res.redirect("/login");
  const { title } = req.body;

  const userAchievementsCount = achievements.filter(a => a.user === req.session.user).length;
  const badge = badgeTierInfo(userAchievementsCount + 1).badge;

  const newAchievement = {
    id: achievements.length + 1,
    user: req.session.user,
    title,
    badge,
    createdAt: new Date().toISOString()
  };
  achievements.push(newAchievement);
  fs.writeFileSync("achievements.json", JSON.stringify(achievements, null, 2));

  res.redirect("/dashboard");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// 404 fallback for unknown routes
app.use((req, res, next) => {
  res.status(404).render("error", { message: "Page not found", status: 404 });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));