from flask import Flask, render_template, request, jsonify
import database
import sqlite3
from datetime import date
import os

def conectar():
    return sqlite3.connect('meu_banco.db')

app = Flask(__name__)
database.inicializar_banco()

# ================= FRONT =================
@app.route("/")
def index():
    return render_template("index.html")



@app.route('/reset-database')
def reset_database():
    db_file = 'odontohub.db' 
    if os.path.exists(db_file):
        os.remove(db_file)
        return "Banco de dados apagado com sucesso! Agora reinicie o serviço no Render."
    return "Ficheiro do banco de dados não encontrado."
# ================= PACIENTES =================
@app.route("/api/pacientes", methods=["GET", "POST"])
def pacientes():
    if request.method == "GET":
        return jsonify(database.buscar_pacientes())
    dados = request.get_json() or {}
    paciente_id = database.adicionar_paciente(
        dados.get("nome"),
        dados.get("cpf", ""),
        dados.get("data_nascimento", ""),
        dados.get("contato", ""),
        dados.get("alergias", "")
    )
    return jsonify({
        "ok": True,
        "id": paciente_id
    }), 201


@app.route("/api/pacientes/<int:id>")
def paciente_id(id):
    paciente = database.buscar_paciente_por_id(id)
    return jsonify(paciente or {})


@app.route("/api/total-pacientes")
def total_pacientes():
    return jsonify({
        "total": database.contar_pacientes()
    })


@app.route("/api/consultas-hoje")
def consultas_hoje():
    hoje = request.args.get("data") or str(date.today())
    total = database.contar_agendamentos_por_dia(hoje)
    return jsonify({"total": total})


# ================= ODONTOGRAMA =================
@app.route("/api/procedimentos/<int:paciente_id>")
def procedimentos(paciente_id):
    return jsonify(database.buscar_procedimentos_por_paciente(paciente_id))


@app.route("/api/salvar-odontograma", methods=["POST"])
def salvar_odontograma():
    dados = request.get_json() or {}
    database.salvar_procedimentos(
        dados.get("paciente_id"),
        dados.get("procedimentos", [])
    )
    return jsonify({"ok": True})

@app.route("/api/procedimento/<int:id>", methods=["DELETE"])
def excluir_proc(id):
    database.excluir_procedimento(id)
    return jsonify({"ok": True})
  
@app.route("/api/agendamentos/<int:paciente_id>")
def agendamentos_paciente(paciente_id):
    conn = database.conectar()
    rows = conn.execute("""
        SELECT * FROM agendamentos
        WHERE paciente_id=?
        ORDER BY data_hora DESC
    """, (paciente_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
  
  
@app.route("/api/agenda", methods=["GET", "POST"])
def agenda():
    if request.method == "GET":
        data = request.args.get("data")
        dentista = request.args.get("dentista")
        if not data:
            return jsonify([])
        if not dentista:
            dentista = "Geral"
        return jsonify(database.buscar_horarios_ocupados(data, dentista))
    dados = request.get_json()
    database.registrar_agendamento(
        dados["data_hora"],
        dados.get("dentista", "Geral"),
        dados["paciente_id"]
    )
    return jsonify({"ok": True})

@app.route("/api/agendamentos")
def listar_agendamentos():
    conn = database.conectar()
    rows = conn.execute("""
        SELECT * FROM agendamentos
        ORDER BY data_hora ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# ================= RUN =================
if __name__ == "__main__":
    app.run(debug=True)