export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método não permitido' });
    }

    try {
        // A forma moderna e correta de ler o corpo da requisição na Vercel
        const { image: base64ImageData } = await request.json();

        if (!base64ImageData) {
            return response.status(400).json({ error: 'Nenhuma imagem fornecida' });
        }

        const prompt = `
            Você é um nutricionista especialista. Analise a comida nesta imagem.
            1. Identifique cada item alimentar.
            2. Estime o peso de cada item em gramas.
            3. Calcule as informações nutricionais (calorias, proteínas, carboidratos, gorduras) para cada item.
            4. Forneça um resumo dos valores nutricionais totais da refeição inteira.
            Responda APENAS com um objeto JSON. Não inclua texto ou explicações fora do JSON.
            O formato deve ser:
            {
              "identified_foods": [
                { "name": "Nome", "grams": 150, "calories": 200, "protein": 30, "carbs": 5, "fat": 8 }
              ],
              "total_nutrition": { "calories": 500, "protein": 30, "carbs": 45, "fat": 15 },
              "disclaimer": "As estimativas são aproximadas e para fins informativos. Consulte um profissional de saúde para aconselhamento nutricional preciso."
            }
        `;
        
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64ImageData } }
                ]
            }],
        };
        
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // Usando o 'fetch' que já vem embutido no ambiente da Vercel
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await geminiResponse.json();

        if (!geminiResponse.ok || !result.candidates || !result.candidates[0].content) {
             console.error("Gemini API Error:", JSON.stringify(result, null, 2));
             return response.status(502).json({ 
                error: "Falha ao obter análise do serviço de IA.",
                details: result
             });
        }
        
        const jsonText = result.candidates[0].content.parts[0].text
            .replace(/```json/g, '').replace(/```/g, '').trim();
        
        const data = JSON.parse(jsonText);
        
        // Retorna a resposta JSON para o navegador do usuário
        return response.json(data);

    } catch (error) {
        console.error('Erro no backend:', error);
        return response.status(500).json({ error: 'Ocorreu um erro interno no servidor.', details: error.message });
    }
}

