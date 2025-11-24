import { GoogleGenAI, Type } from "@google/genai";
import { BallState } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeCollision = async (
  ball1: BallState, 
  ball2: BallState, 
  elasticity: number,
  initialData: { p: number, ke: number },
  finalData: { p: number, ke: number }
): Promise<string> => {
  if (!apiKey) {
    return "API Key missing. Cannot generate analysis.";
  }

  const model = "gemini-2.5-flash";
  
  const prompt = `
    作为一名高中物理老师，请分析以下一维动量碰撞实验的数据。
    
    实验设置:
    - 弹性系数 (Restitution): ${elasticity} (1为完全弹性，0为完全非弹性)
    - 碰撞前:
      - 球1 (质量 ${ball1.mass}kg): 速度 ${ball1.velocity.toFixed(2)} m/s
      - 球2 (质量 ${ball2.mass}kg): 速度 ${ball2.velocity.toFixed(2)} m/s
      - 总动量: ${initialData.p.toFixed(2)} kg·m/s
      - 总动能: ${initialData.ke.toFixed(2)} J
    
    碰撞后 (当前状态):
    - 总动量: ${finalData.p.toFixed(2)} kg·m/s
    - 总动能: ${finalData.ke.toFixed(2)} J

    任务:
    1. 验证动量是否守恒。
    2. 分析动能的变化情况（是否守恒，损失了多少，转化为内能？）。
    3. 给学生一个关于这个特定物理现象的简短总结（100字以内）。
    
    请使用Markdown格式输出，重点突出关键数值。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are an engaging and precise physics tutor.",
        temperature: 0.7,
      }
    });

    return response.text || "无法生成分析结果。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "分析过程中发生错误，请检查网络或API Key。";
  }
};