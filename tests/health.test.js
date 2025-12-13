const request =  require("supertest");
const app =require("../src/app")
describe("Backend basic test",()=>{
    test("Health check should return 200",async()=>{
        const res= await request(app).get("/health");
        expect (res.statusCode).toBe(200);
    });
});
