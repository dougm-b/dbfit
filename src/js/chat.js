// ══════════════════════════════════════════
// AI CHAT — with tool use (add food / add exercise)
// ══════════════════════════════════════════
let chatHistory = [];

const TOOLS = [
  {
    name: 'add_food',
    description: 'Adiciona um alimento a uma refeição do dia especificado (hoje por defeito). Usa sempre que o utilizador pedir para adicionar/registar um alimento ou refeição.',
    input_schema: {
      type: 'object',
      properties: {
        meal: { type: 'string', description: 'Nome da refeição, ex: "☕ Café da manhã", "🍽️ Almoço", "🌙 Jantar" ou um nome livre' },
        food: { type: 'string', description: 'Nome do alimento' },
        qty:  { type: 'number', description: 'Quantidade em gramas ou ml' },
        kcal: { type: 'number', description: 'Calorias' },
        prot: { type: 'number', description: 'Proteína em gramas' },
        carb: { type: 'number', description: 'Carboidratos em gramas' },
        fat:  { type: 'number', description: 'Gordura em gramas' },
        date: { type: 'string', description: 'Data no formato AAAA-MM-DD, opcional, por defeito hoje' }
      },
      required: ['meal', 'food']
    }
  },
  {
    name: 'add_exercise',
    description: 'Adiciona um exercício a um treino/plano existente (procurado pelo nome) ou cria um novo treino com esse nome se não existir. Usa sempre que o utilizador pedir para adicionar um exercício a um treino.',
    input_schema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Nome do treino/plano, ex: "Full Body A"' },
        exercise: { type: 'string', description: 'Nome do exercício' },
        series: { type: 'number', description: 'Número de séries' },
        reps: { type: 'string', description: 'Número de repetições, ex: "10-12"' },
        carga: { type: 'string', description: 'Carga/peso usado, ex: "2x 20kg"' },
        descanso: { type: 'number', description: 'Descanso entre séries em segundos' }
      },
      required: ['plan', 'exercise']
    }
  }
];

function toolAddFood(input) {
  const dateKey = input.date || TODAY;
  const mealName = input.meal || 'Refeição';
  const food = {
    name: input.food, qty: +input.qty || 0, kcal: +input.kcal || 0,
    prot: +input.prot || 0, carb: +input.carb || 0, fat: +input.fat || 0
  };
  addFoodToMeal(dateKey, mealName, food);
  if (dateKey === TODAY) renderDiet();
  updateDash();
  return { ok: true, message: `Alimento "${food.name}" adicionado a "${mealName}" em ${dateKey}.` };
}

function toolAddExercise(input) {
  const planName = input.plan;
  let plan = state.workoutPlans.find(p => p.name.toLowerCase() === String(planName).toLowerCase());
  let created = false;
  if (!plan) {
    plan = { id: nextPlanId(), name: planName, frequency: [], exercises: [] };
    state.workoutPlans.push(plan);
    created = true;
  }
  plan.exercises.push({
    name: input.exercise, series: +input.series || 3, reps: input.reps || '10-12',
    carga: input.carga || '', descanso: +input.descanso || 60
  });
  renderPlans(); renderCalendar();
  return { ok: true, message: `Exercício "${input.exercise}" adicionado ao treino "${plan.name}"${created ? ' (novo treino criado)' : ''}.` };
}

function executeTool(name, input) {
  try {
    if (name === 'add_food') return toolAddFood(input);
    if (name === 'add_exercise') return toolAddExercise(input);
    return { ok: false, error: 'Ferramenta desconhecida' };
  } catch(e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function buildSystemPrompt() {
  const totals = dayTotals(TODAY);
  const h = state.health;
  const g = state.settings;
  const alturaM = (h.altura || 184) / 100;
  const pesoNum = parseFloat(String(h.peso).replace(',', '.'));
  const imc = !isNaN(pesoNum) ? (pesoNum / (alturaM*alturaM)).toFixed(1) : '—';
  const scheduled = state.workoutPlans.filter(p => (p.frequency||[]).includes(now.getDay())).map(p => p.name).join(', ') || 'Sem treino agendado';
  const trainLogs = state.workoutLogs[TODAY] || [];
  const mealsToday = state.meals[TODAY] || [];
  const plansSummary = state.workoutPlans.map(p => `#${p.id} ${p.name} (${(p.exercises||[]).length} exercícios)`).join('; ') || 'Nenhum treino criado ainda';

  return `És o assistente pessoal de fitness e nutrição do Douglas Barros. Responde sempre em português europeu, de forma direta, prática e motivadora.

PERFIL:
- 29 anos, ${h.peso}, ${h.altura || 184} cm (IMC ${imc})
- Objetivo: ganho muscular + recomposição corporal
- Usa testosterona
- Trabalha em casa (8h–17h), treina à noite
- Intolerância leve ao leite puro (tolera queijo, iogurte)

BIOIMPEDÂNCIA ATUAL:
- Peso: ${h.peso} | Gordura: ${h.gc} (meta: 18–22%)
- Gordura visceral: ${h.gv} (PRIORIDADE — meta: <9)
- Músculo total: ${h.musc} | Músculo esquelético: ${h.me}
- Proteína corporal: ${h.prot} | Água corporal: ${h.agua}
- Metabolismo basal: ${h.met} kcal | Idade corporal: ${h.idade}
- Frequência cardíaca: ${h.fc || '—'} bpm | Passos hoje: ${h.passos || 0}

HOJE (${TODAY}):
- Calorias consumidas: ${totals.kcal} / ${g.metaKcal} kcal
- Proteína: ${totals.prot}g / ${g.metaProt}g | Carboidratos: ${totals.carb}g | Gordura: ${totals.fat}g
- Refeições: ${mealsToday.map(m => m.name).join(', ') || 'Nenhuma registada'}
- Treino planeado hoje: ${scheduled}
- Sessões registadas hoje: ${trainLogs.length ? trainLogs.map(t => t.planName).join(', ') : 'Nenhuma'}

TREINOS EXISTENTES: ${plansSummary}
Metas diárias: ${g.metaKcal} kcal | ${g.metaProt}g proteína | ${g.metaAgua}L água

Tens acesso a duas ferramentas: add_food (adiciona um alimento a uma refeição) e add_exercise (adiciona um exercício a um treino existente, ou cria um treino novo se não existir). Sempre que o utilizador pedir para adicionar, registar ou incluir um alimento ou exercício, USA a ferramenta correspondente diretamente — não te limites a explicar como fazer manualmente, executa a ação e depois confirma o que fizeste.`;
}

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages
    })
  });
  return res.json();
}

async function sendMessage() {
  if (!apiKey) {
    showToast('⚠️ Configura a chave API Claude em Configurações');
    showScreen('settings');
    return;
  }
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  addMsg('user', text);
  chatHistory.push({ role: 'user', content: text });

  const btn = document.getElementById('send-btn');
  btn.disabled = true;

  const typing = document.createElement('div');
  typing.className = 'msg ai';
  typing.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  document.getElementById('chat-messages').appendChild(typing);
  scrollChat();

  try {
    let data = await callClaude(chatHistory);
    if (data.error) {
      typing.remove();
      addMsg('ai', '⚠️ Erro: ' + data.error.message);
      btn.disabled = false;
      return;
    }
    let guard = 0;
    while (data.stop_reason === 'tool_use' && guard < 5) {
      guard++;
      const textBlock = (data.content || []).find(b => b.type === 'text' && b.text.trim());
      if (textBlock) {
        typing.remove();
        addMsg('ai', textBlock.text);
        document.getElementById('chat-messages').appendChild(typing);
        scrollChat();
      }
      const toolResults = [];
      for (const block of (data.content || [])) {
        if (block.type === 'tool_use') {
          const result = executeTool(block.name, block.input);
          if (result.ok) showToast('🤖 ' + result.message);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      chatHistory.push({ role: 'assistant', content: data.content });
      chatHistory.push({ role: 'user', content: toolResults });
      data = await callClaude(chatHistory);
      if (data.error) {
        typing.remove();
        addMsg('ai', '⚠️ Erro: ' + data.error.message);
        btn.disabled = false;
        await pushToGitHub();
        return;
      }
    }
    typing.remove();
    const finalText = (data.content || []).find(b => b.type === 'text');
    const reply = finalText ? finalText.text : '⚠️ Sem resposta.';
    chatHistory.push({ role: 'assistant', content: data.content });
    addMsg('ai', reply);
    await pushToGitHub();
  } catch(e) {
    typing.remove();
    addMsg('ai', '❌ Erro de rede. Verifica a ligação.');
  }
  btn.disabled = false;
  scrollChat();
}

function addMsg(role, text) {
  const t = new Date();
  const time = t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = `<div class="msg-bubble">${esc(text).replace(/\n/g,'<br>')}</div><div class="msg-time">${time}</div>`;
  document.getElementById('chat-messages').appendChild(div);
  scrollChat();
}

function scrollChat() {
  const msgs = document.getElementById('chat-messages');
  msgs.scrollTop = msgs.scrollHeight;
}

document.getElementById('chat-input').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});
document.getElementById('chat-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
