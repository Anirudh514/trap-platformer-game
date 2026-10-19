import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path

st.set_page_config(page_title="Trap Platformer", layout="wide")
st.title("Trap Platformer Game")

game_dir = Path(__file__).parent / "game"

html = (game_dir / "index.html").read_text(encoding="utf-8")
css = (game_dir / "style.css").read_text(encoding="utf-8")
js = (game_dir / "game.js").read_text(encoding="utf-8")

html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    f"<style>{css}</style>"
)
html = html.replace(
    '<script src="game.js"></script>',
    f"<script>{js}</script>"
)

components.html(html, height=700, scrolling=True)
