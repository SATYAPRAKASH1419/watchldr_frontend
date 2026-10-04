import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RoomCreatePage } from "./pages/RoomCreatePage";
import { SyncRoom } from "./pages/SyncRoom";
import { RoomJoinPage } from "./pages/RoomJoinPage";

function App() {
  return (
   <BrowserRouter>
      <Routes>
          <Route path="/create" element={<RoomCreatePage/>}/>
          <Route path="/join" element={<RoomJoinPage/>}/>
          <Route path="/room/:roomId" element={<SyncRoom/>}/>
      </Routes>
   </BrowserRouter>
  );
}

export default App;
