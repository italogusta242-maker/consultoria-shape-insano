export interface StoicQuote {
  text: string;
  author: string;
}

export const quotesByState: Record<string, StoicQuote[]> = {
  ativa: [
    { text: "Não é porque as coisas são difíceis que não ousamos. É porque não ousamos que são difíceis.", author: "Sêneca" },
    { text: "O impedimento à ação faz avançar a ação. O que está no caminho torna-se o caminho.", author: "Marco Aurélio" },
    { text: "Primeiro diz a ti mesmo o que serias, e depois faz o que tens de fazer.", author: "Epicteto" },
    { text: "A felicidade da tua vida depende da qualidade dos teus pensamentos.", author: "Marco Aurélio" },
    { text: "Quando te levantares de manhã, pensa no precioso privilégio de estar vivo.", author: "Marco Aurélio" },
    { text: "Nenhum homem é livre se não for senhor de si mesmo.", author: "Epicteto" },
    { text: "A alma torna-se tingida pela cor dos seus pensamentos.", author: "Marco Aurélio" },
    { text: "A riqueza não consiste em ter grandes posses, mas em ter poucas necessidades.", author: "Epicteto" },
    { text: "Age como se cada ação fosse a última da tua vida.", author: "Marco Aurélio" },
    { text: "A glória pertence àquele que está na arena, cujo rosto está marcado de suor e sangue.", author: "Theodore Roosevelt" },
    { text: "Ergue-te, e faz-te digno do que sofres.", author: "Sêneca" },
    { text: "O guerreiro não desiste daquilo que ama. Ele encontra o amor naquilo que faz.", author: "Dan Millman" },
    { text: "Disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
    { text: "O que não te mata, fortalece-te.", author: "Nietzsche" },
    { text: "Vitória ama preparação.", author: "Amir Khan" },
    { text: "A dor que sentes hoje será a força que sentirás amanhã.", author: "Arnold Schwarzenegger" },
    { text: "Somos o que repetidamente fazemos. A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
    { text: "Só os fortes compreendem que a força é uma escolha diária.", author: "Marco Aurélio" },
    { text: "Controla os teus desejos, e não serás escravo de ninguém.", author: "Epicteto" },
    { text: "A verdadeira nobreza é ser superior ao que eras ontem.", author: "Hemingway" },
  ],
  tregua: [
    { text: "A paciência é a companheira da sabedoria.", author: "Santo Agostinho" },
    { text: "Não procures que os acontecimentos aconteçam como desejas. Deseja que aconteçam como acontecem.", author: "Epicteto" },
    { text: "Sofres mais na imaginação do que na realidade.", author: "Sêneca" },
    { text: "O sábio não se aflige pelas coisas que não tem, mas se alegra pelas que tem.", author: "Epicteto" },
    { text: "Um guerreiro descansa, mas não abandona o campo.", author: "Provérbio estoico" },
    { text: "Há mais sabedoria no teu corpo do que na tua mais profunda filosofia.", author: "Nietzsche" },
    { text: "O descanso pertence ao trabalho como as pálpebras pertencem aos olhos.", author: "Rabindranath Tagore" },
    { text: "Às vezes, a coisa mais produtiva que podes fazer é descansar.", author: "Mark Twain" },
    { text: "Quem anda depressa demais tropeça em terreno plano.", author: "Sêneca" },
    { text: "A trégua não é derrota — é estratégia.", author: "Sun Tzu" },
    { text: "Temos duas orelhas e uma boca para que possamos ouvir o dobro do que falamos.", author: "Zenão de Cítio" },
    { text: "Mesmo o sol precisa de noite para que o dia tenha significado.", author: "Provérbio oriental" },
    { text: "Aceita o momento presente como se o tivesses escolhido.", author: "Eckhart Tolle" },
    { text: "O rio que tenta correr sempre mais rápido acaba por secar.", author: "Lao Tzu" },
    { text: "A calma é um superpoder.", author: "Bruce Lee" },
    { text: "Descansa se precisares, mas não desistas.", author: "Banksy" },
    { text: "O silêncio também é uma resposta.", author: "Provérbio estoico" },
    { text: "Recuar um passo pode ser avançar dois.", author: "Sêneca" },
    { text: "Não é o homem que tem pouco que é pobre, mas o que deseja mais.", author: "Sêneca" },
    { text: "Às vezes a espada mais afiada é saber quando embainhar.", author: "Miyamoto Musashi" },
  ],
  extinta: [
    { text: "Não suportes viver sem propósito — é o caminho mais seguro para a ruína.", author: "Marco Aurélio" },
    { text: "A vergonha de ter falhado deveria ser menor que a vergonha de não ter tentado.", author: "Sêneca" },
    { text: "O preço da inação é muito maior do que o custo de um erro.", author: "Meister Eckhart" },
    { text: "Aquele que tem um porquê para viver pode suportar quase qualquer como.", author: "Nietzsche" },
    { text: "A inatividade é o túmulo do homem vivo.", author: "Sêneca" },
    { text: "A tua chama se apaga não quando falhas, mas quando desistes de tentar.", author: "Provérbio estoico" },
    { text: "O maior perigo é que o nosso objetivo seja baixo demais e o alcancemos.", author: "Michelangelo" },
    { text: "O tempo que desperdiças não volta. Cada dia desperdiçado é uma derrota consentida.", author: "Sêneca" },
    { text: "Abandonar a fileira dos vivos enquanto ainda se está vivo é o pior de todos os males.", author: "Sêneca" },
    { text: "O corpo é o teu templo. Abandoná-lo é abandonar a ti mesmo.", author: "Astrid Alauda" },
    { text: "Não esperes por motivação. Age, e a motivação seguirá.", author: "James Clear" },
    { text: "A dor da disciplina pesa gramas. A dor do arrependimento pesa toneladas.", author: "Jim Rohn" },
    { text: "Se não encontrares tempo para o exercício, terás de encontrar tempo para a doença.", author: "Edward Stanley" },
    { text: "O fracasso é o combustível do recomeço — se tiveres coragem.", author: "Provérbio estoico" },
    { text: "Cada dia que passes na inércia, mais pesado se torna o primeiro passo.", author: "Newton" },
    { text: "A tua maior batalha não é contra o mundo. É contra a tua própria preguiça.", author: "David Goggins" },
    { text: "Nada muda se nada mudares.", author: "Tony Robbins" },
    { text: "O conforto é o inimigo silencioso do progresso.", author: "Denzel Washington" },
    { text: "Levanta-te. A arena ainda te espera.", author: "Provérbio gladiador" },
    { text: "Não morremos quando o coração para. Morremos quando deixamos de lutar.", author: "Provérbio espartano" },
  ],
  normal: [
    { text: "A felicidade da tua vida depende da qualidade dos teus pensamentos.", author: "Marco Aurélio" },
    { text: "Não é porque as coisas são difíceis que não ousamos. É porque não ousamos que são difíceis.", author: "Sêneca" },
    { text: "Primeiro diz a ti mesmo o que serias, e depois faz o que tens de fazer.", author: "Epicteto" },
    { text: "Sofres mais na imaginação do que na realidade.", author: "Sêneca" },
    { text: "Quando te levantares de manhã, pensa no precioso privilégio de estar vivo.", author: "Marco Aurélio" },
    { text: "Nenhum homem é livre se não for senhor de si mesmo.", author: "Epicteto" },
    { text: "A alma torna-se tingida pela cor dos seus pensamentos.", author: "Marco Aurélio" },
    { text: "Temos duas orelhas e uma boca para que possamos ouvir o dobro do que falamos.", author: "Zenão de Cítio" },
    { text: "A riqueza não consiste em ter grandes posses, mas em ter poucas necessidades.", author: "Epicteto" },
    { text: "O impedimento à ação faz avançar a ação. O que está no caminho torna-se o caminho.", author: "Marco Aurélio" },
  ],
};

export function getRandomQuote(state: string): StoicQuote {
  const quotes = quotesByState[state] || quotesByState.normal;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export function getDailyQuote(state: string): StoicQuote {
  const quotes = quotesByState[state] || quotesByState.normal;
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return quotes[dayOfYear % quotes.length];
}
