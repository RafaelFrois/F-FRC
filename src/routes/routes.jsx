//Importa compontentes do react-router-dom
import { BrowserRouter, Routes, Route } from "react-router-dom";

//Importa as telas (containers)
import Login from "../containers/login";
import Register from "../containers/register";
import Dashboard from "../containers/home";
import HelpPage from "../containers/help";
import UserProfile from "../containers/user";
import ChooseRegional from "../containers/chose regional/chooseRegional";
import ChooseAlliance from "../containers/chose team/ChooseAlliance";

//Componente que gerencia as rotas da aplicação
export default function AppRoutes(){
    return(
        <BrowserRouter>
        <Routes>
            {/* Rota Inicial */}
              <Route path="/" element={<Login />} />
            
            {/* Rota de Cadastro */}
                <Route path="/register" element={<Register/>} />

            {/* Rota de Dashboard */}
                <Route path="/dashboard" element={<Dashboard/>} />
                <Route path="/entenda-o-jogo" element={<HelpPage/>} />
                <Route path="/user" element={<UserProfile/>} />
                <Route path="/choose-regional" element={<ChooseRegional/>} />
                <Route path="/choose-alliance/:eventKey" element={<ChooseAlliance/>} />

        </Routes>
        </BrowserRouter>
    )
}
