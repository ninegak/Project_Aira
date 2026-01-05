use crate::models::ChatRequest;
use crate::states::SharedAira;
use anyhow::Error as AnyhowError; // Import anyhow::Error
use axum::{
    extract::State,
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
    Json,
};
use futures_util::StreamExt;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

pub async fn chat(
    State(aira): State<SharedAira>,
    Json(req): Json<ChatRequest>,
) -> impl IntoResponse {
    let (tx, rx) = mpsc::channel(128);

    tokio::task::spawn_blocking(move || {
        let mut aira = aira.lock().unwrap();
        let callback = |token: String| {
            tx.blocking_send(Ok(Event::default().data(token)))
                .map_err(|e| anyhow::anyhow!("Failed to send token: {}", e))
        };

        match aira.think(&req.message, callback) {
            Ok(tps) => {
                let _ = tx.blocking_send(Ok(Event::default()
                    .event("tps")
                    .data(tps.to_string())));
            }
            Err(e) => {
                let _ = tx.blocking_send(Ok(Event::default()
                    .event("error")
                    .data(e.to_string())));
            }
        }
    });

    Sse::new(ReceiverStream::new(rx).map(|res| {
        res.map_err(|e: AnyhowError| { // Specify type here
            eprintln!("Error in SSE stream: {}", e);
            axum::Error::new(e)
        })
    }))
}
