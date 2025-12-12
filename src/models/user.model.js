import mongoose , {Schema} from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import * as trace_events from "node:trace_events";
const userModel = new Schema({
  username:{
    type:String,
    require:true,
    unique:true,
    toLowerCase:true,
    trim:true,
    index:true


  },
  password:{
    type:String,
    // require:[true , "password is required"]
  },
  fullName:{
    type:String,
    default:"user---101"

  },
  email:{
    type:String,
    require:true,
    unique:true,
    trim:true
  },
  department:{
    type:String,
    trim:true
  },
  researchInterests:[{
    type:String,
    trim:true
  }],
  isAdmin:{
    type:Boolean,
    default:false
    // require:true
  },
  refreshToken:{
    type:String
  },
  avatar:{
    type:String,
    // require:true
  },
  coverImage:{
    type:String,
    // require:true
  },
  history:[{
    type:Schema.Types.ObjectId,
    ref:"paper"
  }],
  designation:{
    type:String,
    trim:true
  },
  userBio:{
    type:Object,
    default:{}
  },
  userStats:{
    type:Object,
    default:{}
  } ,
  userProfileLink:{
    type:String,
    trim:true
  }


} , {timestamps:true})

userModel.pre("save" , async function(next){
  if (!this.isModified("password")) next();
  this.password = await bcrypt.hash(this.password,10)
  next()
}) //no arrow function kyuki usme context of this nai hoota

userModel.methods.isPasswordCorrect = async function(password) {
  return await bcrypt.compare(password,this.password)

}
userModel.methods.generateAccessToken = function(){
  return jwt.sign({
    _id:this._id,
    username:this.username,
    fullName:this.fullName,
    email:this.email
  },
    process.env.ACCESS_TOKEN_SECRET,{
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
    )
}
userModel.methods.generateRefreshToken = function(){
  return jwt.sign({
    _id:this._id

  },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  )
}
userModel.methods.generateTempToken = function(){

}

export const User = mongoose.model("User" , userModel)