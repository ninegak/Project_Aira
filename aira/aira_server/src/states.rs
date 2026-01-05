use aira_brain::aira::Aira;
use std::sync::{Arc, Mutex};

pub type SharedAira = Arc<Mutex<Aira>>;
