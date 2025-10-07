// Versão com Controlo de Qualidade da Imagem
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método não permitido' });
    }

    try {
        // A Vercel já faz o parse do JSON, então usamos request.body diretamente.
        const { image: base64ImageData } = request.body;

        if (!base64ImageData) {
            return response.status(400).json({ error: 'Nenhuma imagem fornecida' });
        }
        
        // Novo prompt com duas etapas: 1. Validação, 2. Análise
        const prompt = `
            Você é um especialista em análise de imagens de alimentos. Sua tarefa tem duas etapas.
            
            Etapa 1: Validação da Imagem.
            Primeiro, avalie a imagem fornecida com base em dois critérios:
            1. Qualidade da Imagem: A imagem está clara, focada e bem iluminada? Não está escura ou muito desfocada?
            2. Conteúdo da Imagem: A imagem contém claramente alimentos ou uma refeição? Não é uma imagem de outra coisa (por exemplo, uma pessoa, um objeto, uma paisagem)?

            Se a imagem falhar em qualquer um desses critérios, responda APENAS com um objeto JSON no seguinte formato, com uma mensagem de erro apropriada:
            { "error": "validação_falhou", "message": "A razão da falha (ex: A imagem parece estar muito escura ou desfocada. Por favor, tente com mais luz.)" }

            Etapa 2: Análise Nutricional.
            Se, e SOMENTE SE, a imagem passar na validação da Etapa 1, proceda com a análise nutricional.
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

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await geminiResponse.json();

        if (!geminiResponse.ok || !result.candidates || !result.candidates[0].content) {
             console.error("Gemini API Error:", JSON.stringify(result, null, 2));
             return response.status(502).json({ error: "Falha ao obter análise do serviço de IA." });
        }
        
        const jsonText = result.candidates[0].content.parts[0].text
            .replace(/```json/g, '').replace(/```/g, '').trim();
        
        const data = JSON.parse(jsonText);
        
        // Verifica se a própria IA retornou um erro de validação
        if (data.error === "validação_falhou") {
            // Usamos o status 400 (Bad Request) para indicar que a entrada do utilizador (a imagem) era o problema.
            return response.status(400).json({ error: data.message });
        }

        return response.status(200).json(data);

    } catch (error) {
        console.error('Erro no backend:', error);
        return response.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
}

