import { createGlobalStyle } from "styled-components";

const MyGlobalStyles = createGlobalStyle `

    *{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    }

    html, body, #root {
    min-height: 100%;
    height: 100%;
    }

    body{
    background-color: #ffffff;
    overflow-x: hidden;
    }

`

export default MyGlobalStyles