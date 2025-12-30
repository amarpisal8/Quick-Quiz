let currentIndex = 0;
let userAnswers = [];

function loadQuestion() {
  const q = quizData[currentIndex];
  document.getElementById("question").innerText = q.question;

  let optionsHTML = "";
  q.options.forEach((opt, index) => {
    optionsHTML += `
      <div class="option">
        <input type="radio" name="option" value="${index}">
        ${opt}
      </div>
    `;
  });

  document.getElementById("options").innerHTML = optionsHTML;
  document.getElementById("result").innerText = "";
}

function submitAnswer() {
  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) return alert("Select an option");

  const answer = parseInt(selected.value);
  userAnswers.push(answer);

  const correct = quizData[currentIndex].correctAnswer;

  document.getElementById("result").innerHTML =
    answer === correct
      ? "<span class='correct'>Correct Answer</span>"
      : `<span class='wrong'>Wrong Answer</span><br>Correct: ${quizData[currentIndex].options[correct]}`;

  document.getElementById("nextBtn").classList.remove("d-none");

  if (currentIndex === quizData.length - 1)
    document.getElementById("finalSubmit").classList.remove("d-none");
}

function nextQuestion() {
  currentIndex++;
  document.getElementById("nextBtn").classList.add("d-none");
  loadQuestion();
}

function finalSubmit() {
  generatePDF();
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  quizData.forEach((q, i) => {
    pdf.text(`${i + 1}. ${q.question}`, 10, 10 + i * 20);
    pdf.text(`Correct Answer: ${q.options[q.correctAnswer]}`, 10, 16 + i * 20);
  });

  pdf.save("Quiz_Result.pdf");
}

loadQuestion();
