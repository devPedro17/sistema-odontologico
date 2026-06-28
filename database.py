import sqlite3
BANCO = "odontohub.db"


def conectar():
    conn = sqlite3.connect(BANCO)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def inicializar_banco():
    conn = conectar()
    c = conn.cursor()
    # ================= PACIENTES =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT,
        data_nascimento TEXT,
        contato TEXT,
        alergias TEXT
    )
    """)

    # ================= AGENDA =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        dentista TEXT NOT NULL DEFAULT 'Geral',
        data_hora TEXT NOT NULL,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE
    )
    """)

    # ================= ODONTOGRAMA =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS procedimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        dente INTEGER NOT NULL,
        face TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cor TEXT,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE
    )
    """)

    # índices (performance agenda)
    c.execute("CREATE INDEX IF NOT EXISTS idx_agenda_data ON agendamentos(data_hora)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_agenda_paciente ON agendamentos(paciente_id)")
    conn.commit()
    conn.close()


# ================= PACIENTES =================
def adicionar_paciente(nome, cpf, data_nascimento, contato, alergias):
    conn = conectar()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO pacientes (nome, cpf, data_nascimento, contato, alergias)
        VALUES (?, ?, ?, ?, ?)
    """, (nome, cpf, data_nascimento, contato, alergias))
    conn.commit()
    paciente_id = cur.lastrowid
    conn.close()
    return paciente_id


def buscar_pacientes():
    conn = conectar()
    rows = conn.execute("SELECT * FROM pacientes ORDER BY nome").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def buscar_paciente_por_id(id):
    conn = conectar()
    row = conn.execute(
        "SELECT * FROM pacientes WHERE id=?",
        (id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def contar_pacientes():
    conn = conectar()
    total = conn.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0]
    conn.close()
    return total

def contar_agendamentos_por_dia(data):
    conn = conectar()
    total = conn.execute("""
        SELECT COUNT(*)
        FROM agendamentos
        WHERE date(data_hora) = date(?)
    """, (data,)).fetchone()[0]
    conn.close()
    return total

# ================= AGENDA =================
def registrar_agendamento(data_hora, dentista, paciente_id):
    conn = conectar()
    conn.execute("""
        INSERT INTO agendamentos (data_hora, dentista, paciente_id)
        VALUES (?, ?, ?)
    """, (data_hora, dentista, paciente_id))
    conn.commit()
    conn.close()


def buscar_horarios_ocupados(data, dentista):
    conn = conectar()
    if not dentista:
        dentista = "Geral"
    rows = conn.execute("""
        SELECT substr(data_hora, 12, 5) as hora
        FROM agendamentos
        WHERE date(data_hora)=date(?)
        AND dentista=?
    """, (data, dentista)).fetchall()
    conn.close()
    return [r["hora"] for r in rows]


def consultas_hoje(data):
    conn = conectar()
    total = conn.execute("""
        SELECT COUNT(*)
        FROM agendamentos
        WHERE date(data_hora)=date(?)
    """, (data,)).fetchone()[0]
    conn.close()
    return total


# ================= ODONTOGRAMA =================
def salvar_procedimentos(paciente_id, procedimentos):
    conn = conectar()
    conn.execute(
        "DELETE FROM procedimentos WHERE paciente_id=?",
        (paciente_id,)
    )

    for p in procedimentos:
        conn.execute("""
            INSERT INTO procedimentos
            (paciente_id, dente, face, tipo, cor)
            VALUES (?, ?, ?, ?, ?)
        """, (
            paciente_id,
            p.get("dente"),
            p.get("face"),
            p.get("tipo"),
            p.get("cor", "")
        ))
    conn.commit()
    conn.close()


def buscar_procedimentos_por_paciente(paciente_id):
    conn = conectar()
    rows = conn.execute("""
        SELECT * FROM procedimentos
        WHERE paciente_id=?
        ORDER BY dente
    """, (paciente_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def excluir_procedimento(id):
    conn = conectar()
    conn.execute(
        "DELETE FROM procedimentos WHERE id=?",
        (id,)
    )
    conn.commit()
    conn.close()

def listar_agendamentos():
    conn = conectar()
    rows = conn.execute("""
        SELECT * FROM agendamentos ORDER BY data_hora DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def agendamentos_por_paciente(paciente_id):
    conn = conectar()
    rows = conn.execute("""
        SELECT * FROM agendamentos 
        WHERE paciente_id=?
        ORDER BY data_hora DESC
    """, (paciente_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
