import React from "react";
import "./App.css";
import AppStream from "./AppStream";
import StreamConfig from "../stream.config.json";

export interface AppProps {
  sessionId: string;
  backendUrl: string;
  signalingserver: string;
  signalingport: number;
  mediaserver: string;
  mediaport: number;
  accessToken: string;
  onStreamFailed: () => void;
}

interface AppState {
  isKitReady: boolean;
  showStream: boolean;
  showUI: boolean;
  isLoading: boolean;
  loadingText: string;
}

interface AppStreamMessageType {
  event_type: string;
  payload: any;
}

export default class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    this.state = {
      isKitReady: false,
      showStream: true,
      showUI: false,
      loadingText:
        StreamConfig.source === "gfn"
          ? "Log in to GeForce NOW to view stream"
          : StreamConfig.source === "stream"
          ? "Waiting for stream to initialize"
          : "Waiting for stream to begin",
      isLoading: StreamConfig.source === "stream" ? true : false,
    };
  }

  /**
   * @function _queryLoadingState
   *
   * Sends Kit a message to find out what the loading state is.
   * Receives a 'loadingStateResponse' event type
   */
  private _queryLoadingState(): void {
    const message: AppStreamMessageType = {
      event_type: "loadingStateQuery",
      payload: {},
    };
    AppStream.sendMessage(JSON.stringify(message));
  }

  /**
   * @function _onStreamStarted
   *
   * Sends a request to open an asset. If the stream is from GDN it is assumed that the
   * application will automatically load an asset on startup so a request to open a stage
   * is not sent. Instead, we wait for the streamed application to send a
   * openedStageResult message.
   */
  private _onStreamStarted(): void {
    this._pollForKitReady();
  }

  /**
   * @function _pollForKitReady
   *
   * Attempts to query Kit's loading state until a response is received.
   * Once received, the 'isKitReady' flag is set to true and polling ends
   */
  async _pollForKitReady() {
    if (this.state.isKitReady === true) return;

    console.info("polling Kit availability");
    this._queryLoadingState();
    setTimeout(() => this._pollForKitReady(), 3000); // Poll every 3 seconds
  }

  /**
   * @function _onLoggedIn
   *
   * Runs when the user logs in
   */
  private _onLoggedIn(userId: string): void {
    if (StreamConfig.source === "gfn") {
      console.info(`Logged in to GeForce NOW as ${userId}`);
      this.setState({
        loadingText: "Waiting for stream to begin",
        isLoading: false,
      });
    }
  }

  /**
   * @function _handleCustomEvent
   *
   * Handle message from stream.
   */
  private _handleCustomEvent(event: any): void {
    if (!event) {
      return;
    }

    // response received once a USD asset is fully loaded
    if (event.event_type === "openedStageResult") {
      if (event.payload.result === "success") {
        this._queryLoadingState();
      } else {
        console.error(
          "Kit App communicates there was an error loading: " +
            event.payload.url
        );
      }
    }

    // response received from the 'loadingStateQuery' request
    else if (event.event_type == "loadingStateResponse") {
      // loadingStateRequest is used to poll Kit for proof of life.
      // For the first loadingStateResponse we set isKitReady to true
      // and run one more query to find out what the current loading state
      // is in Kit
      if (this.state.isKitReady === false) {
        console.info("Kit is ready to load assets");
        this.setState({ isKitReady: true });
        this._queryLoadingState();
      }
    }

    // Loading progress amount notification.
    else if (event.event_type === "updateProgressAmount") {
      console.log("Kit App communicates progress amount.");
    }

    // Loading activity notification.
    else if (event.event_type === "updateProgressActivity") {
      console.log("Kit App communicates progress activity.");
      if (this.state.loadingText !== "Loading Asset...")
        this.setState({ loadingText: "Loading Asset...", isLoading: true });
    }

    if (event.messageRecipient === "kit") {
      console.log("onCustomEvent");
      console.log(JSON.parse(event.data).event_type);
    }
  }

  /**
   * @function _handleAppStreamFocus
   *
   * Update state when AppStream is in focus.
   */
  private _handleAppStreamFocus(): void {
    console.log("User is interacting in streamed viewer");
  }

  /**
   * @function _handleAppStreamBlur
   *
   * Update state when AppStream is not in focus.
   */
  private _handleAppStreamBlur(): void {
    console.log("User is not interacting in streamed viewer");
  }

  render() {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <AppStream
          sessionId={this.props.sessionId}
          backendUrl={this.props.backendUrl}
          signalingserver={this.props.signalingserver}
          signalingport={this.props.signalingport}
          mediaserver={this.props.mediaserver}
          mediaport={this.props.mediaport}
          accessToken={this.props.accessToken}
          onStarted={() => this._onStreamStarted()}
          onFocus={() => this._handleAppStreamFocus()}
          onBlur={() => this._handleAppStreamBlur()}
          style={{
            position: "relative",
            visibility: this.state.showStream ? "visible" : "hidden",
          }}
          onLoggedIn={(userId) => this._onLoggedIn(userId)}
          handleCustomEvent={(event) => this._handleCustomEvent(event)}
          onStreamFailed={this.props.onStreamFailed}
        />
      </div>
    );
  }
}
