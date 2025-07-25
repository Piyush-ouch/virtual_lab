# 🧪 Virtual Lab: Pendulum Simulation & Phase Difference Analyzer

A fully interactive web-based virtual lab built using **Python Flask**, **JavaScript**, **Chart.js**, and **SQLite** that simulates a simple pendulum experiment with **phase difference calculation**, **data recording**, **AI assistance**, and a complete learning flow from theory to quiz.

> 🎓 Built by: Piyush Jangade & Sneha Chaurasia  
> 📧 Email: piyushjangade06@gmail.com

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [Project Structure](#project-structure)
- [Usage Guide](#usage-guide)
- [Theory](#theory)
- [Prerequisite Quiz](#prerequisite-quiz)
- [AI ViziAPI Interface](#ai-viziapi-interface)
- [Manual](#manual)
- [Roadmap](#roadmap)
- [License](#license)

---

## 📖 Overview

This virtual lab replicates the real-world pendulum experiment, allowing users to:
- Set initial angle and string length.
- Calculate average time period and phase difference.
- Save and load experimental data.
- Export results as CSV.
- Learn the physics behind the experiment with a guided theory section.
- Test themselves using a built-in quiz.
- Use an integrated AI interface (powered by Gemini/Replicate) for smart interaction with experiment content.

---

## ✨ Features

- ⏱️ Real-time pendulum animation  
- 🌀 Phase difference and time difference calculation  
- 📊 Interactive data table with average period calculator  
- 💾 Save, load & export experiment data (CSV)  
- 📘 Built-in Theory and Prerequisite Quiz section  
- 🤖 ViziAI-powered document and image assistant  
- 📄 Styled downloadable manual (PDF)

---

## 📸 Screenshots

> _Add relevant screenshots here (e.g. pendulum interface, quiz, AI chat, theory section, etc.)_

---

## 🛠️ Tech Stack

| Frontend        | Backend     | Database | AI/ML APIs        |
|-----------------|-------------|----------|-------------------|
| HTML5, CSS3, JS | Flask (Python) | SQLite    | Google Gemini API, Replicate SD |

Other Libraries:
- Chart.js (for phase graph)
- Bootstrap 5 (for AI UI)
- PyPDF2 (PDF parsing)
- dotenv, Flask-Limiter, SQLAlchemy

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.8+
- Node.js (if planning frontend builds)
- Internet (for AI API integration)

### Instructions

```bash
git clone https://github.com/Piyush-ouch/virtual_lab.git
cd virtual_lab

# Set up virtual env
python -m venv venv
source venv/bin/activate  # On Windows use venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run the Flask server
python app.py
