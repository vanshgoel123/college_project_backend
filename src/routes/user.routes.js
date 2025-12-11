import {Router} from "express"
import {

  changePassword, completeProfile, deleteUser, getAuthorId, getAuthorScholar,
  getUser, googleAuthLogin,
  login_user,
  logout,
  refreshAccessTokens,
  register_user, report, setPassword, updateAvatar, updateCoverImage, updateUserProfile,
} from "../controllers/user.controller.js";
import { upload_mul } from "../middlewares/multer.middleware.js";
import { jwt_auth } from "../middlewares/auth.middleware.js";
import jwt from "jsonwebtoken";
import { auth_Limiter } from "../middlewares/ratelimiter.middleware.js";
const userRoutes = Router()
userRoutes.route("/register").post(upload_mul.fields([{
  name:"avatar",
  maxCount:1

},{
  name:"coverImage",
  maxCount: 1

}]) , register_user)

//post
userRoutes.route("/login").post( auth_Limiter,login_user)
userRoutes.route("/logout").post(jwt_auth , logout)

userRoutes.route("/googleLogin").post( auth_Limiter,googleAuthLogin)
userRoutes.route("/completeProfile").post(jwt_auth,upload_mul.single("coverImage"),completeProfile)
userRoutes.route("/setPassword").post(jwt_auth , setPassword)
userRoutes.route("/authorProfile").post(jwt_auth , getAuthorScholar)
userRoutes.route("/getAuthorID").post(jwt_auth, getAuthorId)
//get
userRoutes.route("/getUser").get(jwt_auth, getUser)
userRoutes.route("/report").get(jwt_auth,report)


//patch
userRoutes.route("/changePassword").patch(jwt_auth ,changePassword)
userRoutes.route("/setPassword").patch(jwt_auth , setPassword)
userRoutes.route("/refreshAccessToken").patch(jwt_auth , refreshAccessTokens)
userRoutes.route("/updateDetails").patch(jwt_auth , updateUserProfile)
userRoutes.route("/updateAvatar").patch(upload_mul.single("avatar"),jwt_auth,updateAvatar)
userRoutes.route("/updateCoverImage").patch(upload_mul.single("coverImage"),jwt_auth,updateCoverImage)
//del
userRoutes.route("/delete").delete(jwt_auth , deleteUser)

//every controller tested except report....
export default userRoutes
// add forgot password and user mail verification
// add destroy me