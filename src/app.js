import express from "express"
import cors from "cors"
import cookie from "cookie-parser"
import { rate_limit } from "./middlewares/ratelimiter.middleware.js";

console.log("cors---->",process.env.CORS_ORIGIN)

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: "https://scholar.iiitnr.ac.in",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


app.use(express.json({limit:'16kb'}))
app.use(express.urlencoded({extended:true,limit:'16kb'}))
app.use(express.static("public"))
app.use(cookie()) //global middleware hai ye. har req mei cookie as header bhejta hai


import userRoutes from "./routes/user.routes.js";
app.use("/api/v1/users" , userRoutes)

import paperRoute from "./routes/paper.route.js";
app.use("/api/v1/papers" , paperRoute)

import starRoutes from "./routes/star.routes.js";
app.use("/api/v1/star" , starRoutes)

import groupRoutes from "./routes/group.routes.js";
app.use("/api/v1/group" , groupRoutes)

import dashboardRoutes from "./routes/dashboard.routes.js";
app.use("/api/v1/dashboard" , dashboardRoutes)

import patentRoutes from "./routes/patent.routes.js";
app.use("/api/v1/patents" , patentRoutes)

import projectRoute from "./routes/project.route.js";
app.use("/api/v1/projects" , projectRoute)

import adminRoute from "./routes/admin.routes.js";
app.use("/api/v1/admin" , adminRoute)

import portfolioRoutes from "./routes/portfolio.routes.js";

app.use("/api/v1/portfolio", portfolioRoutes)
export {app}
