import React, { useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import { Database } from 'sql.js';
import './App.css';

type Row = any[];

interface Produto {
  codigo: string;
  descricao: string;
  valorUnitario: number;
  imagem?: string;
  quantidade?: number; // para exibir no sidebar
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

const App: React.FC = () => {
  const [db, setDb] = useState<Database | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [codigoBarras, setCodigoBarras] = useState<string>('');
  const [currentSaleId, setCurrentSaleId] = useState<number | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);

  // Abre (ou cria) o IndexedDB com o nome pdvlocal_database
  const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("pdvlocal_database", 1);
      request.onerror = (event) => {
        console.error("Erro ao abrir IndexedDB:", event);
        reject(event);
      };
      request.onupgradeneeded = (event) => {
        console.log("Criando object store no IndexedDB...");
        const idb = (event.target as IDBOpenDBRequest).result;
        idb.createObjectStore("database");
      };
      request.onsuccess = (event) => {
        console.log("IndexedDB aberto com sucesso.");
        resolve((event.target as IDBOpenDBRequest).result);
      };
    });
  };

  // Carrega o banco de dados persistido (se existir)
  const loadDBFromIndexedDB = (idb: IDBDatabase): Promise<Uint8Array | null> => {
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(["database"], "readonly");
      const store = transaction.objectStore("database");
      const getRequest = store.get("db");
      getRequest.onerror = (event) => {
        console.error("Erro ao carregar o banco do IndexedDB", event);
        reject(event);
      };
      getRequest.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          console.log("Banco carregado do IndexedDB.");
          resolve(new Uint8Array(result));
        } else {
          console.log("Nenhum banco encontrado no IndexedDB.");
          resolve(null);
        }
      };
    });
  };

  // Salva o banco de dados no IndexedDB
  const saveDBToIndexedDB = (idb: IDBDatabase, data: Uint8Array): Promise<void> => {
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(["database"], "readwrite");
      const store = transaction.objectStore("database");
      const putRequest = store.put(data, "db");
      putRequest.onerror = (event) => {
        console.error("Erro ao salvar o banco no IndexedDB", event);
        reject(event);
      };
      putRequest.onsuccess = () => {
        console.log("Banco salvo no IndexedDB.");
        resolve();
      };
    });
  };

  // Atualiza o grid usando o saleId informado (para garantir atualização imediata)
  const updateGridForSale = (database: Database, saleId: number) => {
    try {
      const res = database.exec(
        `SELECT codigo, descricao, quantidade, vl_unit, subtotal FROM itens_venda WHERE venda_id = ${saleId}`
      );
      if (res.length > 0) {
        setRows(res[0].values);
        console.log("Grid atualizado com", res[0].values.length, "registros.");
      } else {
        setRows([]);
        console.log("Nenhum item na venda atual.");
      }
    } catch (error) {
      console.error("Erro ao atualizar grid:", error);
    }
  };

  // Calcula o total da venda somando os subtotais dos itens
  const calcularTotal = (): number => {
    if (!db || currentSaleId === null) return 0;
    try {
      const res = db.exec(
        `SELECT SUM(subtotal) as total FROM itens_venda WHERE venda_id = ${currentSaleId}`
      );
      if (res.length > 0 && res[0].values[0][0] !== null) {
        return res[0].values[0][0];
      }
    } catch (error) {
      console.error("Erro ao calcular total:", error);
    }
    return 0;
  };

  // Adiciona um produto à venda usando prepared statements (com cast para any)
  const handleAddProduto = async () => {
    if (!db) return;
    if (codigoBarras.trim() === '') return;
    // Prepara a consulta para buscar o produto
    const stmt = (db as any).prepare("SELECT * FROM produtos WHERE codigo = ?");
    stmt.bind([codigoBarras]);
    if (!stmt.step()) {
      alert("Produto não encontrado!");
      stmt.free();
      return;
    }
    const produtoObj = stmt.getAsObject();
    stmt.free();
    const produto: Produto = {
      codigo: produtoObj.codigo,
      descricao: produtoObj.descricao,
      valorUnitario: produtoObj.valorUnitario,
      imagem: produtoObj.imagem,
      quantidade: 1
    };
    // Atualiza o produto selecionado para exibição dos detalhes
    setProdutoSelecionado(produto);
    // Cria uma nova venda se não houver venda em andamento
    let saleId = currentSaleId;
    if (saleId === null) {
      db.run("INSERT INTO venda (data, total) VALUES (datetime('now'), 0)");
      const saleRes = db.exec("SELECT last_insert_rowid() as id");
      saleId = saleRes[0].values[0][0];
      setCurrentSaleId(saleId);
    }
    // Verifica se o produto já está na venda atual
    const stmt2 = (db as any).prepare("SELECT id, quantidade FROM itens_venda WHERE venda_id = ? AND codigo = ?");
    stmt2.bind([saleId, produto.codigo]);
    let exists = false;
    let itemId: number | undefined = undefined;
    let currentQty: number | undefined = undefined;
    if (stmt2.step()) {
      const row = stmt2.get();
      exists = true;
      itemId = row[0];
      currentQty = row[1];
    }
    stmt2.free();
    if (exists && itemId !== undefined && currentQty !== undefined) {
      const newQty = currentQty + 1;
      const novoSubtotal = newQty * produto.valorUnitario;
      db.run("UPDATE itens_venda SET quantidade = ?, subtotal = ? WHERE id = ?", [
        newQty,
        novoSubtotal,
        itemId
      ]);
      // Atualiza o produto selecionado com a nova quantidade
      setProdutoSelecionado({ ...produto, quantidade: newQty });
    } else {
      const subtotal = produto.valorUnitario;
      db.run(
        "INSERT INTO itens_venda (venda_id, codigo, descricao, quantidade, vl_unit, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
        [saleId, produto.codigo, produto.descricao, 1, produto.valorUnitario, subtotal]
      );
      setProdutoSelecionado({ ...produto, quantidade: 1 });
    }
    setCodigoBarras('');
    if (saleId !== null) {
      updateGridForSale(db, saleId);
    }

  };

  // Inicializa o banco de dados, cria tabelas e insere produtos pré-cadastrados
  useEffect(() => {
    const initDb = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });
        console.log("SQL.js carregado com sucesso.");
        const idb = await openIndexedDB();
        const dbData = await loadDBFromIndexedDB(idb);
        let database: Database;
        if (dbData) {
          console.log("Inicializando banco a partir dos dados persistidos.");
          database = new SQL.Database(dbData);
        } else {
          console.log("Criando novo banco de dados.");
          database = new SQL.Database();
          // Cria as tabelas necessárias
          database.run(`
            CREATE TABLE IF NOT EXISTS produtos (
              codigo TEXT PRIMARY KEY,
              descricao TEXT,
              valorUnitario REAL,
              imagem TEXT
            );
          `);
          database.run(`
            CREATE TABLE IF NOT EXISTS venda (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              data TEXT,
              total REAL
            );
          `);
          database.run(`
            CREATE TABLE IF NOT EXISTS itens_venda (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              venda_id INTEGER,
              codigo TEXT,
              descricao TEXT,
              quantidade INTEGER,
              vl_unit REAL,
              subtotal REAL
            );
          `);
          // Insere produtos pré-cadastrados com nomes e códigos aleatórios
          database.run(
            `INSERT OR IGNORE INTO produtos (codigo, descricao, valorUnitario, imagem)
             VALUES 
               ('7812345678901', 'KINDERINI OVO', 25.0, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSsTCwbWpOQYBp6lECd6RY7QLokrMmQfScE-iitVfpd1tj5O4HGNwt9REJpf0q58CbCbg4geXiflRUPK7q8HKBvE3Sm0Y8QsJM4hbBlB6dwIuW5fzSRJl5aOVTxVsFjdbMxYQ&usqp=CAc'),
               ('7812345678902', 'COCA COLA 2L', 80.0, 'https://m.media-amazon.com/images/I/51ITy60nKVL.jpg'),
               ('7812345678903', 'PRINGLES CLASSIC PAPRIKA', 120.0, 'https://www.lebensmittel-sonderposten.de/media/image/3f/0d/de/Pringles-Classic-Paprika-200g_front_600x600@2x.jpg'),
               ('7812345678904', 'TESLA MODEL X', 45.0, 'https://www.autoscout24.de/cms-content-assets/2tK1JKXjdC3ArkaOcKifGM-e7e9021dda31572e444da92630ac5fcd-tesla-model-x-m-04-1100.jpg'),
               ('7812345678905', 'CHOCOLATE MILKA', 18.0, 'https://www.lebensmittel-sonderposten.de/media/image/61/a6/f9/Milka_Alpenmilch_tafel_100g_front_96dpi_600x600@2x.jpg');`
          );
          await saveDBToIndexedDB(idb, database.export());
        }
        setDb(database);
        if (currentSaleId !== null) {
          updateGridForSale(database, currentSaleId);
        }
      } catch (error) {
        console.error("Erro durante a inicialização:", error);
      }
    };

    initDb();
  }, []);

  // Exporta o banco de dados para download
  const handleDownload = () => {
    if (!db) return;
    console.log("Exportando banco para download...");
    const data = db.export();
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "banco.sqlite";
    a.click();
    URL.revokeObjectURL(url);
    console.log("Banco exportado.");
  };

  // Encerra a venda, atualizando o total na tabela "venda", salvando no IndexedDB e reinicializando a tela
  const encerrarVenda = async () => {
    if (!db || currentSaleId === null) return;
    const total = calcularTotal();
    db.run("UPDATE venda SET total = ? WHERE id = ?", [total, currentSaleId]);
    const idb = await openIndexedDB();
    await saveDBToIndexedDB(idb, db.export());
    alert("Venda encerrada e banco salvo!");
    // Reinicializa: limpa a venda atual, grid e produto selecionado
    setCurrentSaleId(null);
    setRows([]);
    setProdutoSelecionado(null);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>CAIXA ABERTO</h1>
      </div>

      <div className="content-wrapper">
        <div className="main-area">
          <div className="item-list">
            <table>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>CÓDIGO</th>
                  <th>DESCRIÇÃO</th>
                  <th>QTDE</th>
                  <th>VL. UNIT.</th>
                  <th>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{formatCurrency(row[3])}</td>
                    <td>{formatCurrency(row[4])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sidebar">
          <div className="product-image">
            {produtoSelecionado && produtoSelecionado.imagem ? (
              <img src={produtoSelecionado.imagem} alt="Foto do Produto" />
            ) : (
              <img src="assets/img_padrao.png" alt="Imagem padrão" />
            )}
          </div>
          <div className="product-details">
            <div className="input-add">
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="Código de Barras"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProduto();
                }}
              />
            </div>
            <div className="product-details-row">
              <div className="product-details-column">
                <label htmlFor="quantidade">Quantidade:</label>
                <input id="quantidade" type="text" value={produtoSelecionado ? produtoSelecionado.quantidade || 1 : 1} readOnly />
              </div>
              <div className="product-details-column">
                <label htmlFor="preco">Preço:</label>
                <input id="preco" type="text" value={produtoSelecionado ? formatCurrency(produtoSelecionado.valorUnitario) : ''} readOnly />
              </div>
              <div className="product-details-column">
                <label htmlFor="subtotal">Subtotal:</label>
                <input
                  id="subtotal"
                  type="text"
                  value={produtoSelecionado ? formatCurrency((produtoSelecionado.valorUnitario * (produtoSelecionado.quantidade || 1))) : ''}
                  readOnly
                />
              </div>
            </div>
          </div>
          <div className="sidebar-total">
            <div className="product-total">
              <label htmlFor="Total">Total:</label>
              <input id="Total" type="text" value={formatCurrency(calcularTotal())} readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="footer">
        <div className="footer-content">
          <div className="footer-column">
            <p>OPERADOR</p>
            <p>F12 - NFC-e</p>
          </div>
          <div className="footer-column">
            <p>F2 - CONSULTAR ITEM</p>
            <p>F3 - CANCELAR CUPOM</p>
          </div>
          <div className="footer-column">
            <p>F5 - QUANTIDADE</p>
            <p>F6 - DESCONTO</p>
          </div>
          <div className="footer-column">
            <p>F7 - CLIENTES</p>
            <p>F8 - MENU</p>
          </div>
          <button className="receive-button" onClick={encerrarVenda}>
            F10 - ENCERRAR VENDA
          </button>
        </div>
      </div>

      <button className="download-button" onClick={handleDownload}>
        Baixar Banco de Dados
      </button>
    </div>
  );
};

export default App;
