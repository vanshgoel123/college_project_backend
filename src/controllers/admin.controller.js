import { asynchandler } from "../utilities/asynchandler.js";
import { Paper } from "../models/paper.model.js";
import { ApiResponse } from "../utilities/ApiResponse.js";
import { ApiError } from "../utilities/ApiError.js";
import { User } from "../models/user.model.js";
import mongoose, { isValidObjectId } from "mongoose";



const adminDashboard = asynchandler(async (req,res)=>{
  const users = await User.aggregate([{
    $match:{
      isAdmin:false
    }
  }])

  const total=await Paper.find({}).sort({publishedDate:-1})

  const conference=await Paper.find({classifiedAs:"conference"})
  const journal=await Paper.find({classifiedAs:"journal"})
  const bookChapter=await Paper.find({classifiedAs:"book chapter"})
  if(total.length===0 || conference.length===0 || journal.length===0 || bookChapter.length===0) throw new ApiError(404,"no papers found")
  return res.status(200).json(new ApiResponse(200,{totalUsers:users.length,total:total.length,conference:conference.length,journal:journal.length,bookChapter:bookChapter.length},"admin dashboard data fetched successfully"))

})

const from_To = asynchandler(async (req , res)=>{
  const {from , to} = req.body
  if(!from || !from.trim() || !to || !to.trim()) throw new ApiError(400 , "all fields required")

  const start = new Date(`${parseInt(from.trim())-1}-01-01`)
  const end = new Date(`${parseInt(to.trim())}-01-01`) // will be included

  const papers = await Paper.aggregate([{
    $match:{
      publishedDate: {
        $gte:start,
        $lte:end
      }
    }
  },{
    $sort:{
      publishedDate:-1
    }
  } ])

  if(!papers || papers.length === 0) throw new ApiError(400,"cant fetch papers")
  let total_citations = 0;
  for(let i=0; i<papers.length;i++){
    total_citations+=papers[i].citedBy
  }
  return res.status(200).json(new ApiResponse(200, {
    count: papers.length,
    totalCitations:total_citations,
    listOfPapers:papers
  } , "here is your data"))





})







const userDetails = asynchandler(async (req,res)=>{
  const {userId} = req.params


  if(!userId ||!isValidObjectId(userId)) throw new ApiError(400,"invalid user id")
  const user = await User.aggregate([{
    $match: {
      _id: new mongoose.Types.ObjectId(userId),
      isAdmin: false
    }
  },{
    $lookup:{
      from:"paper",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{$sort:{createdAt:-1}}],
      as:"papers"
    }
  },{
    $lookup:{
      from:"projects",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{$sort:{publishedDate:-1}}],
      as:"projects"

    }
  },{
    $lookup:{
      from:"patents",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{$sort:{publishedDate:-1}}],
      as:"patents"
    }
  },{
    $addFields:{
      paperPublishedCount:{$size:"$papers"},
      patentsCount:{$size:"$patents"},
      projectCount:{$size:"$projects"}
    }
  },{
    $project: {
      papers: 1,
      projects:1,
      patents:1,
      paperPublishedCount:1,
      patentsCount:1,
      projectCount:1

    }
  }])
  if(user.length ===0 || user[0].papers.length ===0) throw new ApiError(404,"no user found")
  console.log(user[0])

  const journals =[]
  const conferences =[]
  const bookChapters =[]
  user[0].papers.forEach((item) =>{
    if(item.classifiedAs === "journal") journals.push(item)
    else if(item.classifiedAs === "conference") conferences.push(item)
    else bookChapters.push(item)
  })

  return res.status(200).json(new ApiResponse(200,{
    total:user[0].papers.length,
    journals:journals.length,
    conferences:conferences.length,
    bookChapters:bookChapters.length,
    journalPapers:journals,
    conferencePapers:conferences,
    bookChapterPapers:bookChapters,
    projectsCount:user[0].projects.length,
    projects:user[0].projects,
    patentsCount:user[0].patents.length,
    patents:user[0].patents
  },"user details fetched successfully"))

})

const getAllUsers = asynchandler(async (req,res)=>{
  const users = await User.find({isAdmin:false})
  if(!users || users.length ===0) throw new ApiError(404,"no users found")
  return res.status(200).json(new ApiResponse(200,users,"all users fetched successfully"))
})





export {adminDashboard, userDetails , from_To , getAllUsers}