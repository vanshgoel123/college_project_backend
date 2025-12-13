import request from "supertest";
import { app } from "../src/app.js";

describe("Backend basic test",()=>{
    test("Health check should return 200",async()=>{
        const res= await request(app).get("/health");
        expect (res.statusCode).toBe(200);
    });
});
