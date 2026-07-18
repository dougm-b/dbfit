// ══════════════════════════════════════════
// DIET / FOOD
// ══════════════════════════════════════════
const MEAL_EMOJIS = {
  '☕ Café da manhã':'☕','🥛 Meio da manhã':'🥛','🍽️ Almoço':'🍽️',
  '🍫 Lanche da tarde':'🍫','⚡ Pré-treino':'⚡','🌙 Jantar':'🌙','🌛 Ceia':'🌛'
};

async function addFood() {
  const mealName = document.getElementById('f-meal').value;
  const food = document.getElementById('f-food').value.trim();
  if (!food) { showToast('⚠️ Indica o alimento'); return; }
  addFoodToMeal(TODAY, mealName, {
    name: food,
    qty:  +document.getElementById('f-qty').value  || 0,
    prot: +document.getElementById('f-prot').value || 0,
    kcal: +document.getElementById('f-kcal').value || 0,
    carb: +document.getElementById('f-carb').value || 0,
    fat:  +document.getElementById('f-fat').value  || 0,
  });
  closeModal('food-modal');
  ['f-food','f-qty','f-prot','f-kcal','f-carb','f-fat'].forEach(id => document.getElementById(id).value = '');
  renderDiet();
  updateDash();
  await pushToGitHub();
  showToast('✅ Alimento guardado!');
}

function renderDiet() {
  const meals = state.meals[TODAY] || [];
  const totals = dayTotals(TODAY);
  const g = state.settings;
  document.getElementById('diet-totals').innerHTML = `
    <div class="macro-item"><div class="macro-val" style="color:var(--warn)">${totals.kcal}</div><div class="macro-lbl">kcal / ${g.metaKcal}</div></div>
    <div class="macro-item"><div class="macro-val" style="color:var(--acc)">${totals.prot}g</div><div class="macro-lbl">prot / ${g.metaProt}g</div></div>
    <div class="macro-item"><div class="macro-val" style="color:var(--blue)">${totals.carb}g</div><div class="macro-lbl">carb / ${g.metaCarb}g</div></div>
    <div class="macro-item"><div class="macro-val" style="color:#c084fc">${totals.fat}g</div><div class="macro-lbl">gord / ${g.metaFat}g</div></div>
  `;
  const list  = document.getElementById('meal-list');
  const empty = document.getElementById('meal-empty');
  if (!meals.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = meals.map((meal, mi) => {
    const mkcal = (meal.foods||[]).reduce((a,f) => a + (f.kcal||0), 0);
    return `
    <div class="meal-group">
      <div class="meal-group-hdr">
        <span>${esc(meal.name)}</span>
        <span class="mg-actions">
          <span style="color:var(--acc)">${mkcal} kcal</span>
          <button class="mg-icon-btn" onclick="openFoodModalForMeal(${mi})">+</button>
          <button class="mg-icon-btn" onclick="deleteMeal(${mi})">🗑</button>
        </span>
      </div>
      ${(meal.foods||[]).map((f, fi) => `
        <div class="meal-entry" onclick="deleteFood(${mi},${fi})">
          <div class="meal-emoji">${MEAL_EMOJIS[meal.name] || '🍴'}</div>
          <div class="meal-info">
            <div class="meal-name">${esc(f.name)}${f.qty ? ` — ${f.qty}g` : ''}</div>
            <div class="meal-detail">${f.prot ? f.prot + 'g prot' : ''} ${f.kcal ? '· ' + f.kcal + ' kcal' : ''} ${f.carb ? '· ' + f.carb + 'g carb' : ''}</div>
          </div>
          <div class="meal-kcal">${f.kcal || '—'}<span style="font-size:9px;color:var(--txt3)"> kcal</span></div>
        </div>
      `).join('')}
    </div>
  `; }).join('');
}

async function deleteFood(mi, fi) {
  if (!confirm('Remover este alimento?')) return;
  const meal = state.meals[TODAY][mi];
  meal.foods.splice(fi, 1);
  if (!meal.foods.length) state.meals[TODAY].splice(mi, 1);
  renderDiet(); updateDash();
  await pushToGitHub();
}

async function deleteMeal(mi) {
  if (!confirm('Remover esta refeição e todos os alimentos?')) return;
  state.meals[TODAY].splice(mi, 1);
  renderDiet(); updateDash();
  await pushToGitHub();
}
