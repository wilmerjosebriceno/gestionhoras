# -*- coding: utf-8 -*-
"""
Genera un libro Excel de CALCULO (con formulas) a partir de la
"NORMATIVA DE HORAS, COSTOS Y PRECIOS - SIGESP ERP - Octubre 2026".

El libro resultante es un sistema de cotizacion:
  Parametros      -> tarifas, costos y porcentajes (celdas de entrada)
  Detalle30       -> actividades de implantacion hasta 30 usuarios (editable)
  Horas           -> horas por tramo de usuarios y alcance
  MatrizPrecios   -> precios de todos los tramos/alcances/zonas (calculado)
  Cotizador       -> seleccion de zona/tramo/alcances -> precio, costo y margen
  Mantenimiento   -> tarifas de mantenimiento y simulador
  Costos          -> distribucion de costos y verificacion de ejemplos
  Instrucciones   -> guia de uso y erratas corregidas

Uso:  python generar_excel_normativa.py
"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE_DIR, "Sistema_Calculo_Normativa_SIGESP_Oct2026.xlsx")

# ----------------------------------------------------------------------------
# Estilos
# ----------------------------------------------------------------------------
AZUL = "1F3864"
AZUL2 = "2E5496"
CLARO = "D9E1F2"
GRIS = "F2F2F2"
VERDE = "E2EFDA"
AMARILLO = "FFF2CC"
NARANJA = "FCE4D6"

F_TITULO = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
F_SEC = Font(bold=True, color="FFFFFF", size=11)
F_HEAD = Font(bold=True, color="FFFFFF")
F_BOLD = Font(bold=True)
F_NOTE = Font(italic=True, size=9, color="7F7F7F")
F_BIG = Font(bold=True, size=12, color=AZUL)

FILL_TIT = PatternFill("solid", fgColor=AZUL)
FILL_SEC = PatternFill("solid", fgColor=AZUL2)
FILL_HEAD = PatternFill("solid", fgColor=AZUL2)
FILL_CLARO = PatternFill("solid", fgColor=CLARO)
FILL_GRIS = PatternFill("solid", fgColor=GRIS)
FILL_VERDE = PatternFill("solid", fgColor=VERDE)
FILL_AMAR = PatternFill("solid", fgColor=AMARILLO)
FILL_NARANJA = PatternFill("solid", fgColor=NARANJA)

_thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)

MONEY = '"$"#,##0.00'
NUM = '#,##0.00'
PCT = '0.00%'


def put(ws, cell, value=None, font=None, fill=None, fmt=None,
        align=None, valign="center", wrap=False, border=False):
    c = ws[cell]
    if value is not None:
        c.value = value
    if font:
        c.font = font
    if fill:
        c.fill = fill
    if fmt:
        c.number_format = fmt
    if align or wrap or valign:
        c.alignment = Alignment(horizontal=align, vertical=valign, wrap_text=wrap)
    if border:
        c.border = BORDER
    return c


def title(ws, cell_range, text):
    ws.merge_cells(cell_range)
    first = cell_range.split(":")[0]
    put(ws, first, text, font=F_TITULO, fill=FILL_TIT, align="left")
    ws.row_dimensions[ws[first].row].height = 24


def section(ws, cell_range, text):
    ws.merge_cells(cell_range)
    first = cell_range.split(":")[0]
    put(ws, first, text, font=F_SEC, fill=FILL_SEC, align="left")
    ws.row_dimensions[ws[first].row].height = 20


def header_row(ws, row, headers, start_col=1):
    for i, h in enumerate(headers):
        col = start_col + i
        c = ws.cell(row=row, column=col)
        c.value = h
        c.font = F_HEAD
        c.fill = FILL_HEAD
        c.border = BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def widths(ws, mapping):
    for col, w in mapping.items():
        ws.column_dimensions[col].width = w


# ============================================================================
wb = Workbook()

# ----------------------------------------------------------------------------
# Hoja PARAMETROS
# ----------------------------------------------------------------------------
ws = wb.active
ws.title = "Parámetros"
widths(ws, {"A": 42, "B": 20, "C": 18, "D": 14, "E": 52})

title(ws, "A1:E1", "PARÁMETROS DEL SISTEMA DE CÁLCULO — NORMATIVA SIGESP ERP (Octubre 2026)")

section(ws, "A3:E3", "1. TARIFAS DE VENTA POR ZONA (USD/hora)")
header_row(ws, 4, ["Zona", "Tarifa Presencial ($/h)", "Tarifa Online ($/h)", "", "Estados / cobertura"])
zonas = [
    ("Oriental", 115, 55, "Nueva Esparta, Anzoátegui, Amazonas, Sucre, Monagas, Bolívar, Apure"),
    ("Central", 90, 55, "Caracas, Miranda, Aragua, Carabobo, Guárico"),
    ("Centroccidental", 70, 55, "Lara (Barquisimeto y Cabudare), Yaracuy, Portuguesa, Cojedes"),
    ("Occidental", 105, 55, "Táchira, Mérida, Falcón, Trujillo, Zulia"),
]
for r, (z, p, o, est) in enumerate(zonas, start=5):
    put(ws, f"A{r}", z, font=F_BOLD, border=True)
    put(ws, f"B{r}", p, fmt=MONEY, align="center", border=True)
    put(ws, f"C{r}", o, fmt=MONEY, align="center", border=True)
    put(ws, f"E{r}", est, border=True, wrap=True)

section(ws, "A10:E10", "2. COSTOS DE CONSULTORÍA (USD/hora)")
header_row(ws, 11, ["Zona", "Costo Presencial ($/h)", "Costo Online ($/h)", "", "Nota"])
costos = [
    ("Oriental", 30, 18, "Tarifa plana de consultoría"),
    ("Central", 30, 18, "Tarifa plana de consultoría"),
    ("Centroccidental", 20, 18, "Detalle por estado: Yaracuy 20; Acarigua 18; Guanare/Cojedes 22; Barquisimeto/Cabudare 12; Quíbor/Morán 14 (se usó 20 como promedio)."),
    ("Occidental", 30, 18, "Tarifa plana de consultoría"),
]
for r, (z, p, o, nota) in enumerate(costos, start=12):
    put(ws, f"A{r}", z, font=F_BOLD, border=True)
    put(ws, f"B{r}", p, fmt=MONEY, align="center", border=True)
    put(ws, f"C{r}", o, fmt=MONEY, align="center", border=True)
    put(ws, f"E{r}", nota, border=True, wrap=True)
put(ws, "E11", "Nota", font=F_HEAD, fill=FILL_HEAD, align="center", border=True)
put(ws, "A16", "El costo de hora online no lo fija la normativa original; aquí se propone 18 $/h (60% del presencial). Ajústelo en la columna C.",
    font=F_NOTE)

section(ws, "A17:E17", "3. OTROS PARÁMETROS")
parametros = [
    ("% Impuesto sobre la renta (ISLR)", 0.01, "Regla 1.3.1.4 — 1% del monto recibido"),
    ("% Impuesto municipal (actividades económicas)", 0.03, "Regla 1.3.1.4.1.3.1 — 3%"),
    ("% Gobernación", 0.01, "Regla 1.3.1.4.1.3.1 — 1%"),
    ("% Responsabilidad social", 0.03, "Regla de registro — 3% del monto recibido"),
    ("% Fianzas / retención sustitutiva", 0.10, "10% cuando no se acepta retención"),
    ("% Costos y gastos indirectos (sobre ingreso)", 0.35, "Sugerido; la normativa lo estima por proyecto"),
    ("% Utilidad objetivo mínima", 0.30, "Umbral de control de rentabilidad"),
]
for r, (k, v, nota) in enumerate(parametros, start=18):
    put(ws, f"A{r}", k, border=True)
    put(ws, f"B{r}", v, fmt=PCT, align="center", border=True)
    put(ws, f"E{r}", nota, border=True, wrap=True)
put(ws, "A25", "Índice de inflación acumulado (base Oct-2026 = 1,00)", border=True)
put(ws, "B25", 1.00, fmt=NUM, align="center", border=True)
put(ws, "E25", "Precio_mes = Precio_base × índice. Actualícelo con la variación BCV.", border=True, wrap=True)

# Lista auxiliar de tramos para validacion
put(ws, "E28", "Tramos de usuarios (lista auxiliar)", font=F_BOLD)
for i, t in enumerate([30, 50, 100, 150], start=29):
    put(ws, f"E{i}", t, align="center")

# ----------------------------------------------------------------------------
# Hoja DETALLE30
# ----------------------------------------------------------------------------
d = wb.create_sheet("Detalle30")
widths(d, {"A": 48, "B": 12, "C": 16, "D": 16, "E": 16, "F": 18})
title(d, "A1:F1", "DETALLE DE ACTIVIDADES — IMPLANTACIÓN HASTA 30 USUARIOS (editable)")
put(d, "A2", "Al modificar estas horas, la hoja 'Horas' y la 'MatrizPrecios' se recalculan solas.", font=F_NOTE)
section(d, "A3:F3", "Horas por actividad y alcance")
header_row(d, 4, ["Actividad", "Tipo", "Admon sin nómina (A1)", "Admon con nómina (A2)",
                  "Admon + Comercial (A3)", "Admon + Com. + Producción (A4)"])

actividades = [
    ("Creación del comité de implantación", "Presencial", 2, 2, 2, 2),
    ("Presentación del sistema a todos los usuarios", "Presencial", 3, 3, 3, 3),
    ("Levantamiento presencial de la información", "Presencial", 12, 18, 25, 40),
    ("Certificación de los datos migrados", "Presencial", 12, 18, 24, 32),
    ("Capacitación del personal para carga de datos", "Presencial", 12, 18, 22, 30),
    ("Capacitación simulada del sistema", "Presencial", 18, 18, 24, 36),
    ("Capacitación en vivo", "Presencial", 60, 110, 140, 180),
]
r = 5
for a in actividades:
    put(d, f"A{r}", a[0], border=True, wrap=True)
    put(d, f"B{r}", a[1], border=True, align="center")
    for j, v in enumerate(a[2:], start=3):
        put(d, f"{chr(64+j)}{r}", v, border=True, align="center")
    r += 1
# subtotal presencial
put(d, "A12", "SUBTOTAL PRESENCIAL", font=F_BOLD, fill=FILL_CLARO, border=True)
put(d, "B12", "", fill=FILL_CLARO, border=True)
for j in range(3, 7):
    col = chr(64 + j)
    put(d, f"{col}12", f"=SUM({col}5:{col}11)", font=F_BOLD, fill=FILL_CLARO, border=True, align="center")

online = [
    ("Configuración del sistema y datos básicos", "Online", 35, 60, 80, 120),
    ("Migración de los datos", "Online", 35, 60, 80, 120),
    ("Cambios solicitados en reportes o procesos", "Online", 45, 75, 100, 160),
    ("Mantenimiento 3 meses (incluido en la venta)", "Online", 60, 80, 100, 130),
]
r = 13
for a in online:
    put(d, f"A{r}", a[0], border=True, wrap=True)
    put(d, f"B{r}", a[1], border=True, align="center")
    for j, v in enumerate(a[2:], start=3):
        put(d, f"{chr(64+j)}{r}", v, border=True, align="center")
    r += 1
put(d, "A17", "SUBTOTAL ONLINE", font=F_BOLD, fill=FILL_CLARO, border=True)
put(d, "B17", "", fill=FILL_CLARO, border=True)
for j in range(3, 7):
    col = chr(64 + j)
    put(d, f"{col}17", f"=SUM({col}13:{col}16)", font=F_BOLD, fill=FILL_CLARO, border=True, align="center")
put(d, "A18", "TOTAL HORAS", font=F_BOLD, fill=FILL_VERDE, border=True)
put(d, "B18", "", fill=FILL_VERDE, border=True)
for j in range(3, 7):
    col = chr(64 + j)
    put(d, f"{col}18", f"={col}12+{col}17", font=F_BOLD, fill=FILL_VERDE, border=True, align="center")
put(d, "A20", "Clasificación aplicada (implícita en la normativa): Presencial = comité, presentación, levantamiento, "
              "certificación y capacitaciones. Online = configuración, migración, cambios y mantenimiento.",
    font=F_NOTE)

# ----------------------------------------------------------------------------
# Hoja HORAS
# ----------------------------------------------------------------------------
h = wb.create_sheet("Horas")
widths(h, {"A": 16, "B": 34, "C": 20, "D": 18, "E": 14})
title(h, "A1:E1", "HORAS ESTIMADAS POR TRAMO DE USUARIOS Y ALCANCE")
header_row(h, 3, ["Tramo usuarios", "Alcance", "Horas Presenciales", "Horas Online", "Total"])

# (tramo, alcance, pres, online)  -- para 30 se enlaza al Detalle30
filas = [
    (30, "Admin sin nómina", None, None),
    (30, "Admin con nómina", None, None),
    (30, "Admin + Comercial", None, None),
    (30, "Admin + Comercial + Producción", None, None),
    (50, "Admin sin nómina", 130, 192),
    (50, "Admin con nómina", 206, 300),
    (50, "Admin + Comercial", 260, 400),
    (50, "Admin + Comercial + Producción", 350, 580),
    (100, "Admin sin nómina", 143, 210),
    (100, "Admin con nómina", 225, 330),
    (100, "Admin + Comercial", 285, 440),
    (100, "Admin + Comercial + Producción", 385, 640),
    (150, "Admin sin nómina", 160, 230),
    (150, "Admin con nómina", 250, 360),
    (150, "Admin + Comercial", 300, 480),
    (150, "Admin + Comercial + Producción", 415, 700),
]
# mapeo para filas de 30 usuarios: columna del Detalle30 (C..F)
map30 = {"Admin sin nómina": "C", "Admin con nómina": "D",
         "Admin + Comercial": "E", "Admin + Comercial + Producción": "F"}
r = 4
for tramo, alcance, pres, online in filas:
    put(h, f"A{r}", tramo, border=True, align="center")
    put(h, f"B{r}", alcance, border=True)
    if tramo == 30:
        col = map30[alcance]
        put(h, f"C{r}", f"=Detalle30!{col}12", border=True, align="center")
        put(h, f"D{r}", f"=Detalle30!{col}17", border=True, align="center")
    else:
        put(h, f"C{r}", pres, border=True, align="center")
        put(h, f"D{r}", online, border=True, align="center")
    put(h, f"E{r}", f"=C{r}+D{r}", border=True, align="center", font=F_BOLD)
    r += 1
put(h, "A21", "Para tramos mayores a 30 usuarios la normativa solo ofrece totales (no el detalle por actividad).", font=F_NOTE)

# ----------------------------------------------------------------------------
# Hoja MATRIZ DE PRECIOS
# ----------------------------------------------------------------------------
m = wb.create_sheet("MatrizPrecios")
widths(m, {"A": 12, "B": 34, "C": 14, "D": 14, "E": 15, "F": 15, "G": 17, "H": 16})
title(m, "A1:H1", "MATRIZ DE PRECIOS DE IMPLANTACIÓN (calculada automáticamente)")
put(m, "A2", "Precio = Horas Presenciales × Tarifa_zona + Horas Online × Tarifa_online. Cambie tarifas en 'Parámetros'.", font=F_NOTE)
header_row(m, 3, ["Tramo", "Alcance", "Horas Pres.", "Horas Online", "Oriental", "Central", "Centroccidental", "Occidental"])
r = 4
for tramo in [30, 50, 100, 150]:
    for alcance in ["Admin sin nómina", "Admin con nómina", "Admin + Comercial", "Admin + Comercial + Producción"]:
        put(m, f"A{r}", tramo, border=True, align="center")
        put(m, f"B{r}", alcance, border=True)
        put(m, f"C{r}", f"=SUMIFS(Horas!$C$4:$C$19,Horas!$A$4:$A$19,$A{r},Horas!$B$4:$B$19,$B{r})",
            border=True, align="center")
        put(m, f"D{r}", f"=SUMIFS(Horas!$D$4:$D$19,Horas!$A$4:$A$19,$A{r},Horas!$B$4:$B$19,$B{r})",
            border=True, align="center")
        for j, col in enumerate(["E", "F", "G", "H"]):
            put(m, f"{col}{r}",
                f"=$C{r}*VLOOKUP({col}$3,Parámetros!$A$5:$C$8,2,FALSE)+$D{r}*VLOOKUP({col}$3,Parámetros!$A$5:$C$8,3,FALSE)",
                border=True, align="center", fmt=MONEY)
        r += 1
put(m, "A20", "La fila '30 – Admin + Comercial + Producción / Centroccidental' ya sale corregida (51.760,00) frente al error del documento (58.221,00).",
    font=F_NOTE)

# ----------------------------------------------------------------------------
# Hoja COTIZADOR
# ----------------------------------------------------------------------------
c = wb.create_sheet("Cotizador")
widths(c, {"A": 40, "B": 12, "C": 14, "D": 14, "E": 16, "F": 16, "G": 16, "H": 16})
title(c, "A1:H1", "COTIZADOR DE IMPLANTACIÓN SIGESP ERP")

put(c, "A3", "Zona:", font=F_BOLD)
put(c, "B3", "Oriental", fill=FILL_AMAR, border=True, align="center")
put(c, "A4", "Tramo de usuarios:", font=F_BOLD)
put(c, "B4", 30, fill=FILL_AMAR, border=True, align="center")
put(c, "A5", "N° de usuarios (informativo):", font=F_BOLD)
put(c, "B5", 30, fill=FILL_AMAR, border=True, align="center")
put(c, "A6", "Descuento (%):", font=F_BOLD)
put(c, "B6", 0.0, fill=FILL_AMAR, border=True, align="center", fmt=PCT)
put(c, "A7", "Cliente / proyecto:", font=F_BOLD)
put(c, "B7", "", fill=FILL_AMAR, border=True)

# validaciones
dv_zona = DataValidation(type="list", formula1='"Oriental,Central,Centroccidental,Occidental"', allow_blank=False)
dv_tramo = DataValidation(type="list", formula1="Parámetros!$E$29:$E$32", allow_blank=False)
dv_si = DataValidation(type="list", formula1='"Sí,No"', allow_blank=False)
c.add_data_validation(dv_zona); dv_zona.add(c["B3"])
c.add_data_validation(dv_tramo); dv_tramo.add(c["B4"])
c.add_data_validation(dv_si); dv_si.add(c["B10"]); dv_si.add(c["B11"]); dv_si.add(c["B12"]); dv_si.add(c["B13"])

header_row(c, 9, ["DETALLE POR ALCANCE — Alcance", "Incluir", "Horas Pres.", "Horas Online",
                  "Tarifa Pres. ($/h)", "Precio Pres. ($)", "Precio Online ($)", "Subtotal ($)"])
alcances = ["Admin sin nómina", "Admin con nómina", "Admin + Comercial", "Admin + Comercial + Producción"]
for i, alc in enumerate(alcances):
    r = 10 + i
    put(c, f"A{r}", alc, border=True)
    put(c, f"B{r}", "Sí", border=True, align="center")
    put(c, f"C{r}", f"=SUMIFS(Horas!$C$4:$C$19,Horas!$A$4:$A$19,$B$4,Horas!$B$4:$B$19,$A{r})", border=True, align="center")
    put(c, f"D{r}", f"=SUMIFS(Horas!$D$4:$D$19,Horas!$A$4:$A$19,$B$4,Horas!$B$4:$B$19,$A{r})", border=True, align="center")
    put(c, f"E{r}", "=VLOOKUP($B$3,Parámetros!$A$5:$C$8,2,FALSE)", border=True, align="center", fmt=MONEY)
    put(c, f"F{r}", f"=C{r}*E{r}", border=True, align="center", fmt=MONEY)
    put(c, f"G{r}", f"=D{r}*VLOOKUP($B$3,Parámetros!$A$5:$C$8,3,FALSE)", border=True, align="center", fmt=MONEY)
    put(c, f"H{r}", f'=IF($B{r}="Sí",F{r}+G{r},0)', border=True, align="center", fmt=MONEY)
# totales
put(c, "A15", "TOTALES (solo alcances incluidos)", font=F_BOLD, fill=FILL_CLARO, border=True)
put(c, "B15", "", fill=FILL_CLARO, border=True)
for col, rng in [("C", "C10:C13"), ("D", "D10:D13"), ("F", "F10:F13"), ("G", "G10:G13")]:
    put(c, f"{col}15", f'=SUMIF($B$10:$B$13,"Sí",{rng})', font=F_BOLD, fill=FILL_CLARO, border=True, align="center", fmt=NUM)
put(c, "E15", "", fill=FILL_CLARO, border=True)
put(c, "H15", "=SUM(H10:H13)", font=F_BOLD, fill=FILL_CLARO, border=True, align="center", fmt=MONEY)

put(c, "A17", "Subtotal cotización ($)", font=F_BOLD)
put(c, "C17", "=H15", fmt=MONEY, border=True, align="center")
put(c, "A18", "Descuento aplicado ($)", font=F_BOLD)
put(c, "C18", "=H15*$B$6", fmt=MONEY, border=True, align="center")
put(c, "A19", "TOTAL A COTIZAR ($)", font=F_BIG)
put(c, "C19", "=H15-C18", fmt=MONEY, border=True, align="center", font=F_BIG, fill=FILL_VERDE)

section(c, "A21:H21", "Análisis de costos y rentabilidad")
put(c, "A22", "Costo hora consultor presencial ($/h)", border=True)
put(c, "C22", "=VLOOKUP($B$3,Parámetros!$A$12:$C$15,2,FALSE)", fmt=MONEY, border=True, align="center")
put(c, "A23", "Costo hora online ($/h)", border=True)
put(c, "C23", "=VLOOKUP($B$3,Parámetros!$A$12:$C$15,3,FALSE)", fmt=MONEY, border=True, align="center")
put(c, "A24", "Costo directo de consultoría ($)", border=True)
put(c, "C24", "=C15*C22+D15*C23", fmt=MONEY, border=True, align="center")
put(c, "A25", "Otros costos directos (% del ingreso)", border=True)
put(c, "C25", "=Parámetros!$B$18+Parámetros!$B$19+Parámetros!$B$20+Parámetros!$B$21", fmt=PCT, border=True, align="center")
put(c, "A26", "Otros costos directos ($)", border=True)
put(c, "C26", "=C19*C25", fmt=MONEY, border=True, align="center")
put(c, "A27", "Costos indirectos ($)", border=True)
put(c, "C27", "=C19*Parámetros!$B$23", fmt=MONEY, border=True, align="center")
put(c, "A28", "TOTAL COSTOS ($)", font=F_BOLD, fill=FILL_CLARO, border=True)
put(c, "C28", "=C24+C26+C27", font=F_BOLD, fill=FILL_CLARO, fmt=MONEY, border=True, align="center")
put(c, "A29", "Utilidad estimada ($)", font=F_BOLD, border=True)
put(c, "C29", "=C19-C28", fmt=MONEY, border=True, align="center")
put(c, "A30", "Margen (%)", font=F_BOLD, border=True)
put(c, "C30", "=IF(C19=0,0,C29/C19)", fmt=PCT, border=True, align="center")
put(c, "A31", "Objetivo mínimo (%)", border=True)
put(c, "C31", "=Parámetros!$B$24", fmt=PCT, border=True, align="center")
put(c, "A32", "Control de rentabilidad", font=F_BOLD, border=True)
put(c, "C32", '=IF(C30>=C31,"✔ Cumple el objetivo","✖ Bajo el objetivo")', border=True, align="center")

# ----------------------------------------------------------------------------
# Hoja MANTENIMIENTO
# ----------------------------------------------------------------------------
mt = wb.create_sheet("Mantenimiento")
widths(mt, {"A": 34, "B": 14, "C": 14, "D": 14, "E": 14})
title(mt, "A1:E1", "SERVICIOS DE MANTENIMIENTO ONLINE")
header_row(mt, 3, ["TARIFARIO — Rango de usuarios", "Mensual", "Trimestral", "Semestral", "Anual"])
rangos = [("Hasta 30", 400), ("31 a 60", 700), ("61 a 120", 1000), ("Más de 120", 1500)]
for i, (lab, men) in enumerate(rangos):
    r = 4 + i
    put(mt, f"A{r}", lab, border=True)
    put(mt, f"B{r}", men, border=True, align="center", fmt=MONEY)
    put(mt, f"C{r}", f"=B{r}*3", border=True, align="center", fmt=MONEY)
    put(mt, f"D{r}", f"=B{r}*6", border=True, align="center", fmt=MONEY)
    put(mt, f"E{r}", f"=B{r}*12", border=True, align="center", fmt=MONEY)

section(mt, "A9:E9", "Simulador")
put(mt, "A10", "Rango de usuarios:", border=True)
put(mt, "B10", "Hasta 30", fill=FILL_AMAR, border=True, align="center")
put(mt, "A11", "Plan:", border=True)
put(mt, "B11", "Mensual", fill=FILL_AMAR, border=True, align="center")
put(mt, "A12", "Precio del plan ($):", font=F_BOLD, border=True)
put(mt, "B12", "=INDEX($B$4:$E$7,MATCH($B$10,$A$4:$A$7,0),MATCH($B$11,$B$3:$E$3,0))", fmt=MONEY, border=True, align="center", font=F_BOLD)
put(mt, "A13", "Valor de 3 meses incluidos en la implantación ($):", border=True)
put(mt, "B13", "=3*INDEX($B$4:$B$7,MATCH($B$10,$A$4:$A$7,0))", fmt=MONEY, border=True, align="center")
put(mt, "A14", "Horas equivalentes (tarifa online 55 $/h):", border=True)
put(mt, "B14", "=B13/55", fmt=NUM, border=True, align="center")

dv_rango = DataValidation(type="list", formula1='"Hasta 30,31 a 60,61 a 120,Más de 120"', allow_blank=False)
dv_plan = DataValidation(type="list", formula1='"Mensual,Trimestral,Semestral,Anual"', allow_blank=False)
mt.add_data_validation(dv_rango); dv_rango.add(mt["B10"])
mt.add_data_validation(dv_plan); dv_plan.add(mt["B11"])
put(mt, "A16", "La normativa valora los 3 meses gratuitos como 60–130 horas (3.300–7.150 $), distinto de la tarifa de mantenimiento "
               "(1.200–4.500 $). Este simulador unifica el criterio por tarifa.", font=F_NOTE)

# ----------------------------------------------------------------------------
# Hoja COSTOS
# ----------------------------------------------------------------------------
co = wb.create_sheet("Costos")
widths(co, {"A": 44, "B": 16, "C": 16, "D": 40})
title(co, "A1:D1", "DISTRIBUCIÓN DE COSTOS, GASTOS Y RENTABILIDAD")

section(co, "A3:D3", "Entrada")
put(co, "A4", "Ingreso neto cobrado ($)", border=True)
put(co, "C4", 32000, fmt=MONEY, border=True, align="center", fill=FILL_AMAR)
put(co, "A5", "Horas presenciales facturadas", border=True)
put(co, "C5", 187, border=True, align="center", fill=FILL_AMAR)
put(co, "A6", "Horas online facturadas", border=True)
put(co, "C6", 275, border=True, align="center", fill=FILL_AMAR)
put(co, "A7", "Costo hora presencial ($/h)", border=True)
put(co, "C7", 30, fmt=MONEY, border=True, align="center", fill=FILL_AMAR)
put(co, "A8", "Costo hora online ($/h)", border=True)
put(co, "C8", 18, fmt=MONEY, border=True, align="center", fill=FILL_AMAR)
put(co, "A9", "Total horas", border=True)
put(co, "C9", "=C5+C6", border=True, align="center")

header_row(co, 11, ["COSTOS DIRECTOS — Concepto", "% del ingreso", "Monto ($)", "Nota"], start_col=1)
directos = [
    ("Consultoría presencial", None, "=C5*C7", "horas × costo"),
    ("Consultoría online", None, "=C6*C8", "horas × costo"),
    ("Impuesto sobre la renta (ISLR)", "=Parámetros!$B$18", "AUTO", "1% del monto"),
    ("Impuesto municipal (act. económicas)", "=Parámetros!$B$19", "AUTO", "3% del monto"),
    ("Gobernación", "=Parámetros!$B$20", "AUTO", "1% del monto"),
    ("Responsabilidad social", "=Parámetros!$B$21", "AUTO", "3% del monto"),
    ("Fianzas / retención", "=Parámetros!$B$22", "AUTO", "si no se acepta retención"),
    ("Otros directos", 0.0, "AUTO", "ajustable"),
]
r = 12
for lab, pct, monto, nota in directos:
    put(co, f"A{r}", lab, border=True)
    if pct is None:
        put(co, f"B{r}", "", border=True)
    else:
        put(co, f"B{r}", pct, fmt=PCT, border=True, align="center")
    if monto == "AUTO":
        monto = f"=$C$4*B{r}"
    put(co, f"C{r}", monto, fmt=MONEY, border=True, align="center")
    put(co, f"D{r}", nota, border=True, wrap=True)
    r += 1
put(co, "A20", "TOTAL COSTOS DIRECTOS", font=F_BOLD, fill=FILL_CLARO, border=True)
put(co, "B20", "", fill=FILL_CLARO, border=True)
put(co, "C20", "=SUM(C12:C19)", font=F_BOLD, fill=FILL_CLARO, fmt=MONEY, border=True, align="center")
put(co, "D20", "", fill=FILL_CLARO, border=True)

header_row(co, 22, ["COSTOS INDIRECTOS — Concepto", "% del ingreso", "Monto ($)", "Nota"], start_col=1)
indirectos = [
    ("Honorarios a directivos", 0.25, "=$C$4*B23", "propuesto como % fijo"),
    ("Honorarios administración y desarrollo", 0.10, "=$C$4*B24", "de la venta neta"),
    ("Otros gastos de servicios / personal", 0.025, "=$C$4*B25", "distribución mensual"),
    ("Impuestos actividades económicas SIGESP", 0.03, "=$C$4*B26", "3% del monto"),
    ("Servicios generales (agua, luz, tel.)", 0.015, "=$C$4*B27", "1,5% del bruto"),
    ("Servidores e IA", 0.02, "=$C$4*B28", "estimado"),
    ("Reposición de mobiliario y equipos", 0.02, "=$C$4*B29", "estimado"),
]
r = 23
for lab, pct, monto, nota in indirectos:
    put(co, f"A{r}", lab, border=True)
    put(co, f"B{r}", pct, fmt=PCT, border=True, align="center")
    put(co, f"C{r}", monto, fmt=MONEY, border=True, align="center")
    put(co, f"D{r}", nota, border=True, wrap=True)
    r += 1
put(co, "A30", "TOTAL COSTOS INDIRECTOS", font=F_BOLD, fill=FILL_CLARO, border=True)
put(co, "B30", "", fill=FILL_CLARO, border=True)
put(co, "C30", "=SUM(C23:C29)", font=F_BOLD, fill=FILL_CLARO, fmt=MONEY, border=True, align="center")
put(co, "D30", "", fill=FILL_CLARO, border=True)

put(co, "A32", "TOTAL COSTOS", font=F_BOLD, fill=FILL_VERDE, border=True)
put(co, "C32", "=C20+C30", font=F_BOLD, fill=FILL_VERDE, fmt=MONEY, border=True, align="center")
put(co, "A33", "UTILIDAD ESTIMADA", font=F_BOLD, fill=FILL_VERDE, border=True)
put(co, "C33", "=C4-C32", font=F_BOLD, fill=FILL_VERDE, fmt=MONEY, border=True, align="center")
put(co, "A34", "MARGEN", font=F_BOLD, border=True)
put(co, "C34", "=IF(C4=0,0,C33/C4)", fmt=PCT, border=True, align="center")

header_row(co, 37, ["VERIFICACIÓN DE EJEMPLOS — Concepto", "Documento", "Correcto", "Observación"])
difs = [
    ("Ej. 1 — Otros costos directos de venta", 2200, 2600, "Los componentes (300+200+600+1.500) suman 2.600, no 2.200."),
    ("Ej. 2 — Costos indirectos", 10200, 11200, "Los componentes suman 11.200. Con 11.200 el costo total es 18.300 y la utilidad cae a ~100."),
    ("Ej. 1 — Responsabilidad social (3%)", 600, 960, "3% de 32.000 = 960."),
    ("Ej. 2 — ISLR (1%)", 700, 184, "1% de 18.400 = 184; el documento usa 3,8%."),
]
r = 38
for lab, doc, corr, obs in difs:
    put(co, f"A{r}", lab, border=True)
    put(co, f"B{r}", doc, fmt=MONEY, border=True, align="center")
    put(co, f"C{r}", corr, fmt=MONEY, border=True, align="center")
    put(co, f"D{r}", obs, border=True, wrap=True)
    r += 1

# ----------------------------------------------------------------------------
# Hoja INSTRUCCIONES
# ----------------------------------------------------------------------------
ins = wb.create_sheet("Instrucciones")
widths(ins, {"A": 120})
title(ins, "A1:A1", "INSTRUCCIONES DE USO DEL SISTEMA DE CÁLCULO")
texto = [
    "",
    "1) Todo el libro está enlazado por fórmulas. Las celdas amarillas son entradas editables; las demás se calculan.",
    "",
    "2) Hoja 'Parámetros': tarifas por zona, costos de consultoría, porcentajes de costos/impuestos y utilidad objetivo.",
    "   Cambiar aquí una tarifa actualiza automáticamente la matriz de precios y el cotizador.",
    "",
    "3) Hoja 'Detalle30': actividades de implantación hasta 30 usuarios. Puede editar horas; las hojas 'Horas' y",
    "   'MatrizPrecios' se recalculan. La clasificación presencial/online aplicada es:",
    "       Presencial = comité, presentación, levantamiento, certificación y capacitaciones.",
    "       Online     = configuración, migración, cambios y mantenimiento.",
    "",
    "4) Hoja 'Horas': horas por tramo (30/50/100/150 usuarios) y alcance. Para tramos >30 la normativa solo da totales.",
    "",
    "5) Hoja 'MatrizPrecios': precio de cada combinación tramo × alcance × zona, recalculado con las tarifas vigentes.",
    "   El precio de Centroccidental / A4 / 30 usuarios sale corregido (51.760,00) frente al error del documento (58.221,00).",
    "",
    "6) Hoja 'Cotizador': seleccione Zona y Tramo, marque con 'Sí' los alcances a incluir y obtenga el precio,",
    "   el descuento, el costo directo/indirecto, la utilidad y el margen. El control indica si cumple el objetivo.",
    "",
    "7) Hoja 'Mantenimiento': tarifario mensual/trimestral/semestral/anual y valoración de los 3 meses incluidos.",
    "",
    "8) Hoja 'Costos': distribución de costos y verificación numérica de los ejemplos del documento.",
    "",
    "9) Erratas corregidas en este sistema (detalle en la hoja 'Costos' y en el informe de evaluación):",
    "   - Centroccidental A4 (30 usuarios): 58.221 -> 51.760.",
    "   - Totales de grupos multiplicadores (Central A3, Central A4, Centrocc. A4, Occidental A2).",
    "   - Ejemplo 1 y Ejemplo 2: sumas de costos directos/indirectos inconsistentes.",
    "   - Costo de hora online no definido en la normativa (aquí parametrizado en 18 $/h).",
    "",
    "10) Indexación: actualice el índice de inflación (Parámetros!B25) mensualmente según BCV y multiplíquelo por los precios.",
]
r = 2
for t in texto:
    put(ins, f"A{r}", t)
    r += 1

wb.save(OUT)
print("OK ->", OUT)
