# 📊 Monitor de Bandwidth para Mikrotik

Este projeto consiste em uma interface web para monitoramento em tempo real do tráfego de rede (bandwidth) de uma interface específica em um roteador Mikrotik. A aplicação é dividida em um backend que coleta os dados via SNMP e um frontend que os exibe de forma gráfica e intuitiva.

## 📸 Demonstração

<div align="center">
    <img src="https://private-user-images.githubusercontent.com/80845484/454538754-99e9af68-0cb4-4a53-8fc7-5c9659756bbe.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDk3NTM3NzIsIm5iZiI6MTc0OTc1MzQ3MiwicGF0aCI6Ii84MDg0NTQ4NC80NTQ1Mzg3NTQtOTllOWFmNjgtMGNiNC00YTUzLThmYzctNWM5NjU5NzU2YmJlLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA2MTIlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNjEyVDE4Mzc1MlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI0NDFkM2FiYjM4MzhiOThjODFmZmU2YTkxNWJlYjZmZDZmNzgyMTJjM2Q1MDBhNjExMzkyNjY4MWIwZDM5Y2YmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.vsxZlIhZUzE3QjXTRwe_1TK3M11TBL26hLy-aEBpxKQ">
</div>


## ✨ Funcionalidades

* **Gráfico em Tempo Real:** Exibe o consumo de Download (Rx) e Upload (Tx) em um gráfico dinâmico.
* **Contadores Instantâneos:** Mostra os valores de tráfego atuais com atualização constante.
* **Unidades de Medida Automáticas:** Ajusta a unidade (bps, Kbps, Mbps) de acordo com o volume de tráfego para melhor legibilidade.
* **Backend Leve:** Um servidor Node.js que utiliza o protocolo SNMP para buscar os dados diretamente do roteador.
* **Interface Limpa:** Frontend desenvolvido com HTML, CSS e JavaScript puros, sem a necessidade de frameworks complexos.

## 🛠️ Tecnologias Utilizadas

A solução é dividida em duas partes principais:

### Backend
* **[Node.js](https://nodejs.org/)**: Ambiente de execução para o servidor.
* **[Express](https://expressjs.com/)**: Framework para criar a API e os endpoints.
* **[net-snmp](https://www.npmjs.com/package/net-snmp)**: Biblioteca para comunicação via protocolo SNMP com o roteador.
* **[cors](https://www.npmjs.com/package/cors)**: Para permitir a comunicação entre o frontend e o backend.

### Frontend
* **HTML5**: Estrutura da página.
* **CSS3**: Estilização e layout.
* **JavaScript (ES6+)**: Lógica da aplicação e manipulação da DOM.
* **[Chart.js](https://www.chartjs.org/)**: Biblioteca para a criação dos gráficos.

## 📁 Estrutura do Repositório

O projeto está organizado da seguinte forma dentro do diretório `MikroTik Bandwidth monitor`:

```
├── Back/
│   ├── back.js         # Lógica do servidor backend
│   ├── package.json    # Dependências do Node.js
│   └── ...
└── Front/
├── index.html      # Estrutura da página
├── style.css       # Estilização
└── script.js       # Lógica do frontend e gráficos
```

## 🚀 Instalação e Execução

Siga os passos abaixo para rodar o projeto em sua máquina local.

### Pré-requisitos

* **Node.js** e **npm** instalados.
* Um **roteador Mikrotik** acessível na rede.
* **SNMP** ativado no roteador Mikrotik.

### 1. Configurar o Roteador Mikrotik

1.  Acesse seu roteador Mikrotik (via WinBox ou terminal).
2.  Vá para `IP > SNMP`.
3.  Marque a caixa **Enabled**.
4.  Em `Communities`, crie ou edite uma comunidade. O nome padrão `public` é comumente usado para acesso de leitura. Anote o nome da comunidade.
5.  Anote também o **índice** da interface que você deseja monitorar (ex: `1` para `ether1`). Você pode ver os índices em `Interfaces`.

## 🧪 Alternativa: Usando um Emulador

Se você não possui um roteador MikroTik físico, é possível simular um utilizando o VirtualBox. Você pode instalar uma imagem do RouterOS (o sistema operacional do MikroTik) em uma máquina virtual para realizar os testes.

Para te ajudar, aqui está um tutorial em vídeo que mostra o passo a passo da instalação:

<div align="center">
    <img src="https://img.youtube.com/vi/p1MpoUIt9Q0/hqdefault.jpg">
    <br>
    <a href="https://www.youtube.com/watch?v=p1MpoUIt9Q0"> ➡️ Como instalar o Mikrotik no VirtualBox (PT-BR) </a>
</div>


---

### 2. Configurar e Rodar o Backend

1.  Navegue até a pasta do backend:
    ```bash
    cd Back
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Abra o arquivo `back.js` e configure as seguintes constantes no início do arquivo com os dados do seu roteador:
    ```javascript
    const MIKROTIK_IP = '192.168.56.101'; // IP do seu Mikrotik
    const SNMP_COMMUNITY = 'public';       // Sua comunidade SNMP
    const INTERFACE_INDEX = '2';           // Índice da interface (ex: '2' para ether1)
                                           // Geralmente o índice 1 é o de Loopback
    ```
4.  Inicie o servidor backend:
    ```bash
    node back.js
    ```
    O servidor estará rodando em `http://localhost:3002`.

### 3. Executar o Frontend

1.  Abra o arquivo `Front/index.html` diretamente no seu navegador de preferência (Google Chrome, Firefox, etc.).
2.  Para uma melhor experiência de desenvolvimento, você pode usar a extensão **Live Server** no Visual Studio Code.

## 👤 Autores

* **Geison de Oliveira Lemos Ferreira** - [JasonSX1](https://github.com/JasonSX1)
* **Caroline dos Santos Feitosa** - [carolinesantosf](https://github.com/carolinesantosf)

---