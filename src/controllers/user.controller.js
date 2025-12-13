import {User} from "../models/user.model.js";
import { asynchandler } from "../utilities/asynchandler.js";
import { ApiError } from "../utilities/ApiError.js";
import { ApiResponse } from "../utilities/ApiResponse.js";
import jwt from "jsonwebtoken"
import { upload } from "../utilities/Cloudinary.js";
import { upload_mul } from "../middlewares/multer.middleware.js";
import cookie from "cookie-parser";
import { app } from "../app.js";
import mongoose from "mongoose";
import { verifyGoogleToken } from "../utilities/googleauth.js";
import { authorScholarApi } from "../utilities/scholar.js";
import { Paper } from "../models/paper.model.js";
import generateTags from "../utilities/getTag.js";
import classifyPaper from "../utilities/classifyPaper.js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
  BorderStyle
} from "docx";
import fs from "fs";
import path from "path";

const generateAccessRefershTokens = async function(_id){
  try{
    /** @type {import("../models/user.model.js").User} */
    const user = await User.findById(_id)
    const refreshToken = user.generateRefreshToken()
    const accessToken = user.generateAccessToken()
      // console.log("accessToken " , accessToken ,"refreshToken-->", refreshToken)
    if (!accessToken || !refreshToken) throw new ApiError(400, "tokens not generated in the method")
    user.refreshToken = refreshToken
    await user.save({validateBeforeSave:false})
    return {
      accessToken:accessToken,
      refreshToken:refreshToken
    }




  }catch (e) {
    throw new ApiError(400 , "tokens not generated in the function")
  }
}

const register_user = asynchandler(async (req , res )=>{

  const {fullName , username, password , email, department,isAdmin , researchInterest ,designation}=req.body
  if ([fullName , username, password , email, department,isAdmin,researchInterest ,designation].some((item)=>{
    if (item) {
      if (!item.trim()) return true
    }
    return !item
  })) throw new ApiError(400 , "all fields are required")
  let bool_isAdmin = (typeof isAdmin === "string")
    ? JSON.parse(isAdmin.toLowerCase())
    : Boolean(isAdmin);

  if (!email.includes("@iiitnr.edu.in")) throw new ApiError(400, "enter the administered college email")

  const exists = await User.findOne({
    $or:[{username} , {email}]
  })
  if(exists) throw new ApiError(400, "user already exists please login")
  if(bool_isAdmin && email !== process.env.ADMIN_EMAIL_CHECK) throw new ApiError(401 , "you are not allowed to register as admin")

 const local_path_avatar = req?.files?.avatar[0]?.path
  if (!local_path_avatar) throw new ApiError(401, "multer didnt upload avatar")
  const local_path_coverImage = req?.files?.coverImage[0].path
  if (!local_path_coverImage) throw new ApiError(401, "multer didnt upload coverImage")

  const upload_avatar =await  upload(local_path_avatar)
  if ( !upload_avatar.url) throw new ApiError(401 , "avatar cloudinary error")
  const upload_coverImage =await  upload(local_path_coverImage)
  if ( !upload_coverImage.url) throw new ApiError(401 , "coverImage cloudinary error")
  const array =[]
  researchInterest.split(",").forEach((item)=>{
    if (item.trim()) array.push(item.trim())
  })
  if (array.length===0) throw new ApiError(400 , "add some research interest")

  const user =await User.create({
    username:username,
    fullName:fullName,
    avatar:upload_avatar.url || "",
    coverImage:upload_coverImage.url||"",
    email:email,
    department:department,
    isAdmin:bool_isAdmin,
    password:password,
    researchInterests:array,
    designation:designation
  })
  const response = await User.findById(user._id).select("-password -refreshToken")

  return res
    .status(200)
    .json(new ApiResponse(200, response, "user created"))













})
const login_user = asynchandler(async (req , res ,_)=>{
  const {email , password} = req.body
  if (!email.trim() || !password) throw new ApiError(401 , "enter full details")

  /** @type {import("../models/user.model.js").User} */

  const user = await User.findOne({
    email
  });
  if (!user) throw new ApiError(401 , "please register")

  /** @type {import("../models/user.model.js").User} */
  const isCorrect = await user.isPasswordCorrect(password)
  if (!isCorrect) throw new ApiError(401 , "password is wrong")
  const {accessToken , refreshToken} = await generateAccessRefershTokens(user._id)
  const options = {
    httpOnly:true,
    secure:true
  }
  user.refreshToken = ""
  user.password = ""

  if (user.isAdmin) {
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, {
        user: user,
        accessToken: accessToken,
        refreshToken: refreshToken
      }, "logged in as admin"))
  }
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {
      user: user,
      accessToken: accessToken,
      refreshToken: refreshToken
    }, "logged in as user"))





})
const googleAuthLogin = asynchandler(async (req,res)=>{
  const {idToken_name , idToken_email} = req.body
if (!idToken_email || !idToken_name) throw new ApiError(400 , "google never sent token")
  const payload_email =await  verifyGoogleToken(idToken_email)
  const payload_name = await verifyGoogleToken(idToken_name)
  if (!payload_name) throw new ApiError(400 , "google didnt verify name")
  if (!payload_email) throw new ApiError(400 , "google didnt verify_email")
  const {email} = payload_email
  const {name , picture} = payload_name
  if (!email || !name) throw new ApiError(400 , "google didnt send email or name")
  if (!email.includes("@iiitnr.edu.in")) throw new ApiError(400, "enter the administered college email")





  /** @type {import("../models/user.model.js").User} */
  const user = await User.findOne({
    email:email
  }).select("-password -refreshToken")


  if (!user) {
    const created =await  User.create({
      fullName:name,
      email:email,
      username:email.split("@")[0] + "101",
      avatar:picture || "",
    })
    if (!created) throw new ApiError(400 , "user not created")

  if(created?.email === process.env.ADMIN_EMAIL_CHECK) {
    created.isAdmin = true
    await created.save({validateBeforeSave:false})
  }
    const option = {
      httpOnly:true,
      secure:true
    }
    const {accessToken,refreshToken} =await generateAccessRefershTokens(created._id)

    if (!accessToken || !refreshToken) throw new ApiError(400, "tokens not generated")
    return res
      .status(200)
      .cookie("accessToken" , accessToken , option)
      .cookie("refreshToken" , refreshToken,option)
      .json(new ApiResponse(200,created , "logged in "))





  }
  const options = {
    httpOnly:true,
    secure:true
  }
  const {accessToken,refreshToken} = await generateAccessRefershTokens(user._id)
  // console.log("accessToken " , accessToken ,"refreshToken-->", refreshToken)
  if (!accessToken || !refreshToken) throw new ApiError(400, "tokens not generated")
  return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , refreshToken,options)
    .json(new ApiResponse(200,user , "logged in "))




})
const completeProfile = asynchandler(async (req , res)=>{
  /** @type {import("../models/user.model.js").User} */

  console.log("req.files-->" , req.files)

  const {department , isAdmin , researchInterest ,designation} = req.body
  if (!department || !department.trim()|| !isAdmin || !isAdmin.trim() || !researchInterest|| !researchInterest.trim()) throw new ApiError(400 , "add details")


  const local_path_coverimage = req?.file?.path
  if (!local_path_coverimage) throw new ApiError(400 , "coverImage not fetched from multer")

  const onCloud_coverImage = await upload(local_path_coverimage)


  if (!onCloud_coverImage.url) throw new ApiError(400 , "coverImage not uploaded on cloudinary")
  const bool_isAdmin = (typeof isAdmin === "string")
    ? JSON.parse(isAdmin.toLowerCase())
    : Boolean(isAdmin);
  const array =[]
  researchInterest.split(",").forEach((item)=>{
    if (item.trim()) array.push(item.trim())
  })
  if (array.length===0) throw new ApiError(400 , "add some research interest")
  const user = await User.findByIdAndUpdate(req.user._id, {
    $set:{
      department:department,
      isAdmin:bool_isAdmin,
      coverImage:onCloud_coverImage?.url || "",
      researchInterests:array,
      designation:designation
    }
  } ,{new:true})
  if (!user) throw new ApiError(400 , "profile not completed")
 return  res.status(200)
    .json(new ApiResponse(200,user , "profile updated"))


})


const  setPassword = asynchandler(async (req,res,next)=> {
  const { new_password, confirm_password } = req.body
  if (!new_password.trim() || !confirm_password.trim()) throw new ApiError(401, "np empty strings")
  if (new_password !== confirm_password) throw new ApiError(400, "doest match with the confirm password")
  const user = await User.findById(req?.user?._id)
  if (!user) throw new ApiError(400, "user not fetched ")
  user.password = new_password
  await user.save({ validateBeforeSave: false })
  return res.status(200)
    .json(new ApiResponse(200, {}, "password set"))
})


const logout= asynchandler(async (req,res,_)=>{
const user =await User.findByIdAndUpdate(req?.user?._id , {
  // $set:{
  //   refreshToken:undefined
  // }
  $unset: { refreshToken: 1 }
} , {new:true}).select("-password")
  const options = {
  http: true,
    secure: true
  }
  return res.status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200 , user , "logged out successfully"))



})
const getUser =asynchandler(async (req , res )=>{
  const user = await User.findById(req?.user?._id).select("-password -refreshToken")
  return res.status(200).json(new ApiResponse(200 , user , "here are your details"))
})
const changePassword = asynchandler(async (req , res)=>{
  const {original_password , new_password , confirm_password}  = req.body
  if (!original_password.trim()||!new_password.trim() ||!confirm_password.trim()) throw new ApiError(401 , "np empty strings")
  if (new_password!==confirm_password) throw new ApiError(400 , "doest match with the confirm password")

  /** @type {import("../models/user.model.js").User} */


  const user= await User.findById(req?.user?._id)
  if (!user)  throw new ApiError(400 , "user not fetched ")
  if (!(await user.isPasswordCorrect(original_password)))  throw new ApiError(400 , "password wrong")
  user.password = new_password
  user.save({validateBeforeSave:false})
  return res.status(200)
    .json(new ApiResponse(200 ,{} , "password changed"))

})
const refreshAccessTokens = asynchandler(async (req,res)=>{
  /** @type {import("../models/user.model.js").User} */

  const user = await User.findById(req.user._id).select('-password')
  if (!user) throw new ApiError(401, "user no no no")
  const token = req.cookies.refreshToken || req.body.refreshToken
  if (!token) throw new ApiError(401, "noo token")
  if (token !== user.refreshToken) throw new ApiError(500, "maslaa")
  const { accessToken, refreshToken } = await generateAccessRefershTokens(req.user._id)

  const options = {
    http: true,
    secure: true
  }
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {
      user: user,
      new_accessToken: accessToken,
      new_refreshToken: refreshToken
    }, "cookies updated"))





})
const updateUserProfile = asynchandler(async (req,res)=>{
  const {new_email,new_username} = req.body
  if (!new_email.trimEnd() || !new_username.trim()) throw new ApiError(401 , "user please enter something")
  if (!new_email.includes("@iiitnr.edu.in")) throw new ApiError(400, "enter the administered college email")

  /** @type {import("../models/user.model.js").User} */

  const user = await User.findByIdAndUpdate(req.user._id ,{

    $set:{
      email:new_email,
      username:new_username
    }
  },{new:true})

  return res.status(200)
    .json(new ApiResponse(200 , user , "updated details"))





})

const updateAvatar = asynchandler(async (req,res)=>{
  const local_path = req?.file?.path
  if (!local_path) throw new ApiError(401 , "path not found")
  const upload_ = await upload(local_path)
  if (!upload_.url) throw new ApiError(401 , "not uploaded")

  /** @type {import("../models/user.model.js").User} */

  const user = await User.findByIdAndUpdate(req.user._id , {
    $set:{
      avatar:upload_.url
    }
  },{new:true})
  if (!user) throw new ApiError(400,"user not fetched")
  console.log("user new avatar-->",user.avatar)
  return res.status(200).json(new ApiResponse(200 , user , "avatar updated"))


})

const updateCoverImage = asynchandler(async (req,res)=>{
  const local_path_ = req?.file?.path
  if (!local_path_) throw new ApiError(401 , "path not found")
  const upload_cover = await upload(local_path_)
  if (!upload_cover.url) throw new ApiError(401 , "not uploaded")

  /** @type {import("../models/user.model.js").User} */

  const user = await User.findByIdAndUpdate(req.user._id , {
    $set:{
      coverImage:upload_cover.url
    }
  },{new:true})
  if (!user) throw new ApiError(400,"user not fetched")
  return res.status(200).json(new ApiResponse(200 , user , "avatar updated"))


})
const deleteUser = asynchandler(async (req,res,next)=>{
  const user = await User.findByIdAndDelete(req.user._id)
  if (!user) throw new ApiError(401 , "sorry....user not deleted")

  res.status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new  ApiResponse(200,{},"logged out and deleted"))

})
const report = asynchandler(async (req, res) => {
  const {
    title = false,
    authors = false,
    tag = false,
    publishedBy = false,
    publishedDate = false,
    citedBy = false,
  } = req.body;

  const projectObject = {};

  if (title === true) projectObject.title = 1;
  if (authors === true) projectObject.authors = 1;
  if (tag === true) projectObject.tag = 1;
  if (publishedBy === true) projectObject.publishedBy = 1;
  if (publishedDate === true) projectObject.publishedDate = 1;
  if (citedBy === true) projectObject.citedBy = 1;

  // Always include URLs
  projectObject.link = 1;
  projectObject.manualUpload = 1;

  const paperReport = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "paper",
        localField: "_id",
        foreignField: "owner",
        pipeline: [
          {
            $addFields: {
              link: {
                $cond: {
                  if: { $and: [{ $ne: ["$link", null] }, { $ne: ["$link", ""] }] },
                  then: "$link",
                  else: "$$REMOVE",
                },
              },
              manualUpload: {
                $cond: {
                  if: { $and: [{ $ne: ["$manualUpload", null] }, { $ne: ["$manualUpload", ""] }] },
                  then: "$manualUpload",
                  else: "$$REMOVE",
                },
              },
            },
          },
          {
            $project: projectObject,
          },
        ],
        as: "details",
      },
    },
    {
      $addFields: { count: { $size: "$details" } },
    },
    {
      $project: { details: 1, count: 1 },
    },
  ]);

  if (!paperReport.length || !paperReport[0].details.length)
    throw new ApiError(400, "report not generated");

  const reportData = paperReport[0].details;

  const FIELD_MAP = {
    title: { label: "Title", enabled: title },
    authors: { label: "Authors", enabled: authors },
    tag: { label: "Tag", enabled: tag },
    publishedBy: { label: "Published By", enabled: publishedBy },
    publishedDate: { label: "Published Date", enabled: publishedDate },
    citedBy: { label: "Cited By", enabled: citedBy },
    link: { label: "Link", enabled: true },
    manualUpload: { label: "Manual Upload", enabled: true },
  };

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Research Paper Report",
            heading: HeadingLevel.TITLE,
          }),

          ...reportData.flatMap((paper, index) => {
            const block = [];

            // Heading
            block.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                text: `${index + 1}. ${FIELD_MAP.title.enabled ? paper.title || "" : ""}`,
              })
            );

            // Add all enabled fields
            for (const key in FIELD_MAP) {
              const { label, enabled } = FIELD_MAP[key];
              if (!enabled || !paper[key]) continue;

              // Special handling for URLs
              if (key === "link" || key === "manualUpload") {
                block.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${label}:`, bold: true }),
                      new TextRun({ break: 1 }), // Move URL to next line
                      new TextRun({
                        text: paper[key],
                        style: "Hyperlink", // clickable link
                      }),
                    ],
                  })
                );

                block.push(new Paragraph("")); // spacing
                continue;
              }

              // Normal text fields
              if (Array.isArray(paper[key])) {
                block.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${label}: `, bold: true }),
                      new TextRun(paper[key].join(", ")),
                    ],
                  })
                );
              } else {
                block.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${label}: `, bold: true }),
                      new TextRun(String(paper[key])),
                    ],
                  })
                );
              }
            }

            block.push(new Paragraph("")); // spacing
            return block;
          }),
        ],
      },
    ],
  });

  // Generate DOCX
  const buffer = await Packer.toBuffer(doc);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.setHeader("Content-Disposition", "attachment; filename=report.docx");

  return res.send(buffer);
});


const getAuthorScholar = asynchandler(async (req , res)=>{
  const {authorId} = req.body
  if(!authorId.trim()) throw new ApiError(400 , "please enter author id")


  const response = await authorScholarApi(authorId)


  if(!response) throw new ApiError(400 , "cant fetch author info");
  const {stats , papers , author} = response

  if(!papers || papers.length === 0 ) throw new ApiError(500 , "papers can be fetched")
  
  const userPapers = await Paper.find({
    owner:req?.user?._id
  }).select("link")
  if(userPapers.length !== 0){
    for (let i = 0; i < papers.length; i++) {
      const p = papers[i]
      for (let j = 0; j < userPapers.length; j++) {
        if(p?.link.trim() === userPapers[j]?.link.trim()){
          papers.splice(i ,1)
        }

      }

    }
    
  }

  if(papers.length === 0) throw new ApiError(400 , "all papers already exist in the database")

  const formatedPapers=[]

  papers.forEach((item)=>{
    const authors = []
    item?.authors.split(",").forEach(a => {
      if (a.trim() !== "") authors.push(a.trim())
    })
    let classifiedAs =  "conference"
    const verdict = classifyPaper({
      title: item?.title || "",
      publication: item?.publication || ""
    })
    if(verdict !== "Other / Unknown") classifiedAs = verdict

    const tags = []
    generateTags(item?.title || "" ).forEach(tag => {
      if (tag.trim() !== "") tags.push(tag.trim().toLowerCase())
    })
    generateTags(item?.publication || "" ).forEach(tag => {
      if (tag.trim() !== "" && !tags.includes(tag.trim())) tags.push(tag.trim().toLowerCase())
    })

    formatedPapers.push({
      title: item?.title  ,
      link: item?.link,
      authors: authors,
      citedBy: item?.cited_by?.value,
      publishedBy: item?.publication,
      publishedDate: new Date(Number(item?.year),0) || new Date(),
      classifiedAs: classifiedAs,
      tag: tags,
      owner: req?.user?._id


    })



  })

  const createPapers = await Paper.insertMany(formatedPapers)
  if(!createPapers || createPapers.length ===0) throw new ApiError(500 , "papers not stored")



  // for(let i  =0  ; i<papers.length ; i++) {
  //   // const exists = await Paper.findOne({
  //   //   link:papers[i].link,
  //   //   owner:req?.user?._id
  //   // })
  //   // if(exists) continue;
  //
  //   const authors = []
  //   papers[i]?.authors.split(",").forEach(a => {
  //     if (a.trim() !== "") authors.push(a.trim())
  //   })
  //   let classifiedAs =  "conference"
  //   const verdict = classifyPaper({
  //     title: papers[i]?.title || "",
  //     publication: papers[i]?.publication || ""
  //   })
  //   if(verdict !== "Other / Unknown") classifiedAs = verdict
  //
  //   const tags = []
  //   generateTags(papers[i]?.title || "" ).forEach(tag => {
  //     if (tag.trim() !== "") tags.push(tag.trim().toLowerCase())
  //   })
  //   generateTags(papers[i]?.publication || "" ).forEach(tag => {
  //     if (tag.trim() !== "" && !tags.includes(tag.trim())) tags.push(tag.trim().toLowerCase())
  //   })
  //
  //
  //
  //
  //
  //
  //   try {
  //     const paper = await Paper.create({
  //       title: papers[i]?.title  ,
  //       link: papers[i]?.link,
  //       authors: authors,
  //       citedBy: papers[i]?.cited_by?.value,
  //       publishedBy: papers[i]?.publication,
  //       publishedDate: new Date(Number(papers[i]?.year),0) || new Date(),
  //       classifiedAs: classifiedAs,
  //       tag: tags,
  //       owner: req?.user?._id
  //
  //
  //     })
  //
  //     if(!paper) throw new ApiError(500 , "paper not stored")
  //
  //
  //   } catch (e){
  //     throw new ApiError(500, `mongoDb error---->${e.message}`)
  //
  //   }
  // }

  const userUpdate = await User.findByIdAndUpdate(req.user._id , {
    $set:{
      userBio:author,
      userStats:stats
    }
  } , {new:true})
  if (!userUpdate) throw new ApiError(500 , "user bio not updated")



  return res.status(200).json(new ApiResponse(200 , {
    stats:stats || {},
    paperCount: formatedPapers.length,
    author: author || {}
  } , `all papers of ${author.name} have been stored in the database`))









})


const getAuthorId = asynchandler(async (req,res)=>{

  const {url} = req.body;

  if (!url || typeof url !== "string") {
    throw new ApiError(400, "URL is required in request body");
  }
  if(req?.user?.userProfileLink && req?.user?.userProfileLink.trim() !== url.trim()){
    throw new ApiError(400 , "you have already set your profile link , cannot change it")
  }
  const isLinkAlreadyThere = await User.findOne({userProfileLink: url.trim()})
  if(isLinkAlreadyThere && isLinkAlreadyThere._id !== req?.user?._id) throw new ApiError(400 , "this profile link is already associated with another user")



  const user = await User.findByIdAndUpdate(req?.user?._id , {
    $set:{
      userProfileLink:url.trim()
    }
  } , {new:true}).select("-password -refreshToken")
  if (!user) throw new ApiError(400, "user not found to update profile link");



    const parsedUrl = new URL(url);
    const authorId = parsedUrl.searchParams.get("user");

    if (!authorId) {
      throw new ApiError(400, "Author ID not found in provided URL");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { authorId },
        "Author ID extracted successfully"
      )
    );




})



export { getAuthorId,  register_user , login_user , logout , getUser , changePassword , refreshAccessTokens,updateUserProfile,updateAvatar,updateCoverImage,deleteUser , report , googleAuthLogin , completeProfile , setPassword , getAuthorScholar}
