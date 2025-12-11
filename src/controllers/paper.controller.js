import {asynchandler} from "../utilities/asynchandler.js";
import {ApiResponse} from "../utilities/ApiResponse.js";
import {ApiError} from "../utilities/ApiError.js";
import {Paper} from "../models/paper.model.js";
import {searchScholarAPI} from "../utilities/scholar.js";
import { upload } from "../utilities/Cloudinary.js";
import { User } from "../models/user.model.js";
import mongoose, { isValidObjectId } from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "google-auth-library";


const getPapers = asynchandler(async (req , res)=>{
  const papers = await Paper.find({owner:req?.user?._id}).sort({publishedDate:-1})
  if(!papers || papers.length ===0) throw new ApiError(400 , "cant get papers")

  return res.status(200)
    .json(new ApiResponse(200,papers,"here is your collection"))

})
const SearchPaperScholar = asynchandler(async (req,res)=>{
  let  {query,fromYear,tillYear} = req.body

  if(!query) throw ApiError(400 , "enter some query")

  if(fromYear && typeof fromYear !=="number") fromYear = parseInt(fromYear)
  if(tillYear && tillYear !=="number") tillYear = parseInt(tillYear)


  const response = await searchScholarAPI(query , fromYear,tillYear)
  if (!response || response.length ===0) throw new ApiError(400 , "scholar search not working")



  res.status(200)
    .json(new ApiResponse(200,response,"here is your search"))


})

const saveThesePapers = asynchandler(async (req , res)=>{
  const {arr} = req.body
  if (!arr || arr.length ===0) throw new ApiError(400 , "enter some array")


  const response=[]

  for (let i=0;i<arr.length;i++){
    const exists = await Paper.findOne({
      link:arr[i].link
    })
    if(exists) continue;

    const authors =[]
    arr[i]?.authors?.publication_info?.authors.forEach((obj)=>{
      authors.push(obj.name)
    })
    const yearMatch = arr[i]?.publication_info?.summary.match(/\b\d{4}\b/)


    const paper = await Paper.create({
      title: arr[i].title,
      authors:authors || [],
      publishedBy: arr[i]?.publication_info?.summary,
      link: arr[i].link,
      publishedDate: yearMatch[0] || "",// change to Date type
      owner: req?.user?._id,
      // pdfUrl: arr[i].pdf_url,
      citedBy: arr[i].inline_links.cited_by.total,
    })
    if(!paper) throw new ApiError(400 , "cant create paper")
    response.push(paper)
  }
  return res.status(200)
    .json(new ApiResponse(200,response,"papers saved successfully"))


})
const uploadPaperManual = asynchandler(async (req , res)=>{

console.log(req.body)

  const {title , author , publishedDate , publishedBy , tag,classifiedAs} = req.body;
  if (!title || !author || !publishedDate || !publishedBy || !tag)  throw new ApiError(400 , "enter details properly")

  const local_pdf = req.file.path;
  if (!local_pdf) throw new ApiError(400 , "multer messed")
  const upload_pdf = await upload(local_pdf);
  if (!upload_pdf.url) throw new ApiError(400 , "cloudinary messed")
  const tags = []
  tag.split(",").forEach(t=>{
    if (t.trim()!=="") tags.push(t.trim())
  })
  if (tags.length === 0) throw new ApiError(400 , "enter some tags")
  const authors =[]
  author.split(",").forEach(a=>{
    if (a.trim()!=="") authors.push(a.trim())
  })
  if (authors.length === 0) throw new ApiError(400 , "enter some authors")

  const paper = await Paper.create({
    title:title,
    authors:authors,
    manualUpload:upload_pdf.url || "",
    publishedDate:publishedDate,
    owner:req?.user?._id,
    publishedBy:publishedBy,
    isManual:true,
    tag:tags,
    isPublished:false,
    classifiedAs:classifiedAs?.toLowerCase()?.trim()

  })
if (!paper) throw new ApiError(400 , "cant create paper")
  return res.status(200)
    .json(new ApiResponse(200,paper,"paper uploaded manually"))
})


const getUserConferencePapers = asynchandler(async (req,res)=>{

  const papers = await Paper.find({owner:req?.user?._id,classifiedAs:"conference"}).sort({publishedDate:-1})
  if (!papers || papers.length ===0) throw new ApiError(400 , "cant get papers")


  return res.status(200)
    .json(new ApiResponse(200,papers,"here is your collection"))

})

const getUserJournals = asynchandler(async (req,res)=>{

  const papers = await Paper.find({owner:req?.user?._id,classifiedAs:"journal"}).sort({publishedDate:-1})
  if (!papers ) throw new ApiError(400 , "cant get papers")


  return res.status(200)
    .json(new ApiResponse(200,papers,"here is your collection"))

})

const getUserBookChapter = asynchandler(async (req,res)=>{

  const papers = await Paper.find({owner:req?.user?._id,classifiedAs:"book chapter"}).sort({publishedDate:-1})
  if (!papers) throw new ApiError(400 , "cant get papers")


  return res.status(200)
    .json(new ApiResponse(200,papers,"here is your collection"))

})

const paperById = asynchandler(async (req,res)=>{
  const {paperId} = req.params
  if (!paperId.trim() || !isValidObjectId(paperId)) throw new ApiError(400 , "naah")

  const paper = await Paper.findById(paperId)
  if (!paper) throw new ApiError(400 , "paper not found")
  return res.status(200)
    .json(new ApiResponse(200,paper,"your paper"))




})
const deletePaper = asynchandler(async (req,res)=>{
  const {paperId} = req.params

  if (!paperId.trim() || !isValidObjectId(paperId)) throw new ApiError(400 , "naah")

  const deleted = await Paper.findByIdAndDelete(paperId)
  if (!deleted) throw new ApiError(400 , " paper not deleted")

  return res.status(200)
    .json(new ApiResponse(200,deleted,"your paper deleted"))
})
const searchPaper = asynchandler(async (req,res)=>{
  const { page=1, query, sortBy="publishedDate"} = req.query
  if(!query) throw new ApiError(400 , "nah")

  const limit = 10
  const skip = (parseInt(page) -1)*limit
  const searchResult = await User.aggregate([{
    $match:{
      _id: new mongoose.Types.ObjectId(req.user._id)
    }
  },{
    $lookup:{
      from:"paper",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          $or:[{
            title: {
              $regex: query,
              $options: 'i'
            }
          } , {
            authors:{
              $regex: query,
              $options: 'i'
            }
          }]



      }
      },{
        $sort:{
          [sortBy]: -1
        }

      },{
        $skip:skip,


      },{
        $limit:limit

      },{
        $project:{
          title:1,
          link:1,
          authors:1,
          tag:1,
          citedBy:1,
          publishedBy:1,
          publishedDate:1,
          manualUpload:1,


        }
      }],
      as:"search"
    }
  },{
    $project:{
      search:1
    }

  }])

  if (searchResult.length===0 || searchResult[0].search.length===0)  throw new ApiError(400 , "cant search")
  return res.status(200)
    .json(new ApiResponse(200,searchResult[0],"your search"))


})
const getManualUploads = asynchandler(async (req , res)=>{
  const manualPaper = await User.aggregate([{
    $match:{
      _id:new mongoose.Types.ObjectId(req.user._id)
    }
  },{
    $lookup:{
      from:"paper",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          isManual:true
        }
      },{
        $project:{
          title:1,
          authors:1,
          manualUpload:1,
          tag:1,
          publishedDate:1,
          publishedBy:1,
          citedBy:1,
          pdfUrl:1,

      }
      }],
      as:"manualUploads"
    }
  },{
    $project:{
      manualUploads:1
    }
  }])

})

const getScholarUploads = asynchandler(async (req , res)=>{
  const scholarPaper = await User.aggregate([{
    $match:{
      _id:new mongoose.Types.ObjectId(req.user._id)
    }
  },{
    $lookup:{
      from:"papers",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          isManual:false
        }
      },{
        $project:{
          title:1,
          authors:1,
          link:1,
          tag:1,
          publishedDate:1,
          publishedBy:1,
          citedBy:1,
          pdfUrl:1,

        }
      }],
      as:"scholarUploads"
    }
  },{
    $project:{
      scholarUploads:1
    }
  }])

})

const filter_search = asynchandler(async (req,res)=>{
  const {title ="", authors="" , tag=""  , isManual} = req.body
  if (title.trim() === ""&& authors.trim() === ""&& tag.trim() === ""&& isManual === undefined) throw new ApiError(400 , "naah")
  const arr = []
  if (!(title.trim()==="")) arr.push({
    title:{
      $regex:title,
      $options:'i'
    }
  })
  if (!(authors.trim()==="")) arr.push({
    authors:{
      $regex:authors,
      $options:'i'
    }
  })
  if (!(tag.trim()==="")) arr.push({
    tag:{
      $regex:tag,
      $options:'i'
    }
  })
  if (!(isManual===undefined)) arr.push({isManual:isManual})

  const search = await User.aggregate([{
    $match:{
      _id:new mongoose.Types.ObjectId(req.user._id)
    }
  },{
    $lookup:{
      from:"papers",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          $and:arr
        }
      },{$project:{
        link:1,
          manualUpload:1


        }}],
      as:"searchResults"
    }
  },{
    $project:{
      searchResults:1
    }
  }])
  if (search.length === 0 || search[0].searchResults.length === 0) throw new ApiError(400 , "no searches")
  return res.status(200)
    .json(new ApiResponse(200 , search[0] , "here are your search results"))


})

const getPublishedPapers  = asynchandler(async (req , res) =>{
  const published_papers = await User.aggregate([{
    $match:{
      _id:new mongoose.Types.ObjectId(req?.user?._id)
    }
  },{
    $lookup:{
      from:"papers",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          isPublished:true
        }
      },{
        $project:{
          title:1,
          authors:1,
          link:1,
          manualUpload:1
        }
      }],
      as:"publishedPapers"
    }
  },{
    $project:{
      publishedPapers:1
    }
  }])
  if (published_papers.length === 0 || published_papers[0].publishedPapers.length ===0) throw ApiError(400 , "published papers cant be fetched")
  return res.status(200)
    .json(new ApiResponse(200 , published_papers[0] , "here are your published papers"))

})

const getAboutToBePublishedPapers  = asynchandler(async (req , res) =>{
  const about_to_be_published_papers = await User.aggregate([{
    $match:{
      _id:new mongoose.Types.ObjectId(req?.user?._id)
    }
  },{
    $lookup:{
      from:"papers",
      localField:"_id",
      foreignField:"owner",
      pipeline:[{
        $match:{
          isPublished:false
        }
      },{
        $project:{
          title:1,
          authors:1,
          link:1,
          manualUpload:1
        }
      }],
      as:"aboutToBePublishedPapers"
    }
  },{
    $project:{
      aboutToBePublishedPapers:1
    }
  }])
  if (about_to_be_published_papers.length === 0 || about_to_be_published_papers[0].aboutToBePublishedPapers.length ===0) throw ApiError(400 , "published papers cant be fetched")
  return res.status(200)
    .json(new ApiResponse(200 , about_to_be_published_papers[0] , "here are your about to be published papers"))

})

const addTag = asynchandler(async (req , res)=> {
  const { paperId } = req.params
  const { tags } = req.body
  if (!paperId.trim() || !isValidObjectId(paperId)) throw new ApiError(400, "naah")
  if (!tags.length===0) throw new ApiError(400, "enter some tag")
  const paper = await Paper.findById(paperId)
  if (!paper) throw new ApiError(400, "paper not found")
  if (paper.owner.toString() !== req.user._id.toString()) throw new ApiError(403, "not your paper")

  tags.split(",").forEach(tag=>{
    if (tag.trim()!=="" && !paper.tag.includes(tag.trim().toLowerCase())) paper.tag.push(tag.trim())
  })

  const updated = await paper.save()
  if (!updated) throw new ApiError(400, "tag not added")
  return res.status(200)
    .json(new ApiResponse(200, updated, "tag added"))
})

const downloadPaper = asynchandler(async (req , res)=>{
  const {paperId} = req.params
  if (!paperId.trim() || !isValidObjectId(paperId)) throw new ApiError(400 , "naah")
  const paper = await Paper.findById(paperId)
  if (!paper) throw new ApiError(400 , "paper not found")
  if (paper.isManual){
    if (!paper.manualUpload) throw new ApiError(400 , "no manual upload link")
    return res.redirect(paper.manualUpload)
  } else {
    if (!paper.link) throw new ApiError(400 , "no scholar link")
    return res.status(200).redirect(paper.link)

  }

})

const deleteAll = asynchandler(async (req , res)=>{
  const deleted = await Paper.deleteMany({})
  if(!deleted.acknowledged) throw new ApiError(400 , "deletion failed")
  const userUpdate = await User.findByIdAndUpdate(req.user._id,{
    $set:{
      userBio:{},
      userStats:{}
    }
  } , {new:true})
  return res.status(200)
    .json(new ApiResponse(200,"all papers deleted"))
})

export {
  SearchPaperScholar,
  uploadPaperManual,
  getUserConferencePapers,
  paperById,
  deletePaper,
  searchPaper,
  filter_search,
  getManualUploads,
  getScholarUploads,
  getPublishedPapers,
  getAboutToBePublishedPapers,
  addTag,
  downloadPaper,
  getUserJournals,
  getUserBookChapter,
  saveThesePapers,
  getPapers,
  deleteAll
};





// downloadPaper (return Cloudinary link or Scholar link).


// admin flags


//add a video into the website of how to use it
