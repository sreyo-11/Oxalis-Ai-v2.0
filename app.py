import os
import time
import requests
import streamlit as st

BACKEND_URL = os.getenv("OXALIS_BACKEND_URL", "[http://127.0.0.1:8000](http://127.0.0.1:8000)")

st.set_page_config(page_title="Oxalis AI", page_icon="⚡", layout="wide")

# Minimalist professional UI styling
st.markdown("""
    <style>
    .stApp { font-family: 'Inter', sans-serif; background-color: #fcfcfc; }
    .stButton > button { border-radius: 4px; border: 1px solid #111; background: #111; color: #fff; font-weight: 500; }
    .stButton > button:hover { background: #333; color: #fff; border-color: #333; }
    .css-1d391kg { padding-top: 2rem; }
    div[data-testid="stMetricValue"] { font-size: 1.2rem; font-weight: 600; }
    </style>
""", unsafe_allow_html=True)

st.title("⚡ Oxalis Intelligence")
st.markdown("### Enterprise Technical Blueprint Generator")
st.divider()

col1, col2 = st.columns([2, 1])
with col1:
    topic = st.text_input("Strategic Objective", placeholder="e.g., Distributed real-time analytics pipeline")
    context = st.text_area("Architectural Constraints", placeholder="Specify cloud providers, tech stacks, or compliance requirements")
with col2:
    timeframe = st.selectbox("Development Phase", ["1 Week Sprint", "1 Month Phase", "Q1 Deliverables"])
    
if st.button("Generate Blueprint", use_container_width=True):
    if not topic.strip():
        st.error("Strategic Objective is required.")
        st.stop()
        
    try:
        resp = requests.post(f"{BACKEND_URL}/plan", json={"project_topic": topic, "timeframe": timeframe, "additional_context": context})
        resp.raise_for_status()
        job_id = resp.json()["job_id"]
    except requests.RequestException as e:
        st.error(f"Backend connectivity failed: {e}")
        st.stop()

    status_card = st.empty()
    progress_bar = st.progress(0.0)
    
    while True:
        try:
            r = requests.get(f"{BACKEND_URL}/plan/{job_id}", timeout=5)
            job = r.json()
            
            progress_bar.progress(job["progress"])
            status_card.metric("Current Agent", job["stage"], delta=f"{int(job['progress']*100)}%")
            
            if job["status"] == "done":
                progress_bar.empty()
                status_card.empty()
                st.success("Blueprint Finalized.")
                st.markdown(job["result"])
                st.download_button("Download Markdown", data=job["result"], file_name="architecture_blueprint.md")
                break
            elif job["status"] == "error":
                st.error(f"Execution failed: {job.get('error')}")
                break
                
            time.sleep(1.5)
        except requests.RequestException:
            time.sleep(1.5)