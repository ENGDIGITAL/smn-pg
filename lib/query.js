function Query(connection, options) {
    this.schema = options.schema;

    this.connection = connection;
    this.input = input;
    this.inputMany = inputMany;

    this.asyncExec = asyncExec;
    this.asyncExecOne = asyncExecOne;

    this.createQuery = createQuery;
    this.createQueryName = createQueryName;
    this.isJson = isJson;
    this.params = [];
    this.paramsName = [];

    function input(...parameters) {
        if (!parameters)
            throw new Exception('Parameter exception', 'Nenhum parâmetro informado.');

        if (parameters.length == 1 && (typeof parameters[0] != 'object' || parameters[0] == null)) {
            inputIndex(this, parameters[0]);
        } else if (parameters.length == 2 && typeof parameters[0] != 'object') {
            inputName(this, parameters[0], parameters[1]);
        } else if (typeof parameters[0] == 'object') {
            object(this, parameters[0], parameters[1]);
        }
        return this;
    }

    function inputMany(...value) {
        if (this.paramsName.length)
            throw new Exception('Parameter exception', 'Não utilize input e (inputName ou object) na mesma consulta');

        this.params = this.params.concat(value);
        return this;
    }

    //-----------FUNCS AUX------------------

    function inputIndex(query, value) {
        if (query.paramsName.length)
            throw new Exception('Parameter exception', 'Não utilize input e (inputName ou object) na mesma consulta');

        query.params.push(value);
    }

    function inputName(query, name, value, elem) {
        if (query.params.length)
            throw new Exception('Parameter exception', 'Não utilize input e inputName ou object na mesma consulta');

        query.paramsName.push({
            name,
            value,
            elem: elem
        });
    }

    function object(query, obj, prefix) {
        prefix = prefix || '';
        for (let i in obj) {
            inputName(query, prefix + i, obj[i]);
        }
    }

    //-----------------------------

    /**
     * @description
     * 
     * Executar uma procedure retornando muitos registros.
     * 
     * @param {String} procedureName    Nome completo da procedure
     * @param {Object?} transaction      Transação ja iniciada   
     * 
     * @returns {Object}          
     */
    async function asyncExec(procedureName, transaction) {
        procedureName = _resolveProcedureName(this, procedureName);

        if (!transaction)
            return await asyncExecute(this, procedureName);
        return await asyncTransExecute(this, transaction, procedureName);
    }

    /**
     * @description
     * 
     * Executar uma procedure retornando um unico registro.
     * 
     * @param {String} procedureName    Nome completo da procedure
     * @param {Object?} transaction      Transação ja iniciada 
     * 
     * @returns {Object}         
     */
    async function asyncExecOne(procedureName, transaction) {
        procedureName = _resolveProcedureName(this, procedureName);

        if (!transaction)
            return await asyncExecuteOne(this, procedureName);
        return await asyncTransExecuteOne(this, transaction, procedureName);
    }

    //-----------------------------


    function createQuery(procedureName) {
        let paramsIndice = '';
        this.params && this.params.map((obj, i) => {
            paramsIndice += `$${(+i + 1)}, `;
        });
        paramsIndice = paramsIndice.slice(0, -2);

        return `SELECT * FROM ${procedureName}(${paramsIndice})`;
    }

    function createQueryName(procedureName) {
        let paramsIndice = '';
        this.paramsName.map(x => {
            paramsIndice += `${x.name} := ${(x.value == null || x.value == undefined ? 'NULL' : paramsResolve(x.value))}, `;
        });
        paramsIndice = paramsIndice.slice(0, -2);

        return `SELECT * FROM ${procedureName}(${paramsIndice})`;
    }

    function paramsResolve(value) {
        const setE = true;
        if (typeof value == 'object')
            value = JSON.stringify(value);

        if (isJson(value)) return `'${value}'`;

        if (typeof value == 'string')
            value = value.replace(/(\')|(\\')/g, "\\'");
        return `E'${value}'`;
    }

    function isJson(value) {
        try {
            return typeof JSON.parse(value) == 'object';
        } catch (error) {
            return false;
        }
    }
}

function Exception(name, message) {
    this.message = message;
    this.name = name;
}

//---------------- AUX. FUNC EXEC ------------------------------------------------------


async function asyncExecute(obj, procedureName) {
    const returns = await obj.connection.query(obj[obj.params.length ? 'createQuery' : 'createQueryName'](procedureName), obj.params);

    const name = _prepareProcedureName(procedureName);
    if (returns && Object.getOwnPropertyNames(returns).includes(name))
        return returns[name];

    return returns;
}

async function asyncExecuteOne(obj, procedureName) {
    const returns = await obj.connection.oneOrNone(obj[obj.params.length ? 'createQuery' : 'createQueryName'](procedureName), obj.params);

    const name = _prepareProcedureName(procedureName);
    if (returns && Object.getOwnPropertyNames(returns).includes(name))
        return returns[name];

    return returns;
}

async function asyncTransExecute(obj, trans, procedureName) {
    let returns = await trans.query(obj[obj.params.length ? 'createQuery' : 'createQueryName'](procedureName));

    const name = _prepareProcedureName(procedureName);
    if (returns && Object.getOwnPropertyNames(returns).includes(name))
        return returns[name];

    return returns;
}

async function asyncTransExecuteOne(obj, trans, procedureName) {
    let returns = await trans.oneOrNone(obj[obj.params.length ? 'createQuery' : 'createQueryName'](procedureName));

    const name = _prepareProcedureName(procedureName);
    if (returns && Object.getOwnPropertyNames(returns).includes(name))
        return returns[name];

    return returns;
}

//---------------- AUX. FUNC AUX.------------------------------------------------------

function _resolveProcedureName(obj, procedureName) {
    if (procedureName.split('.').length)
        return procedureName;

    if (!obj.schema) throw { message: 'Schema não informado, verifique.' };

    return `${obj.schema}.${procedureName}`;
}

function _prepareProcedureName(procedureName) {
    const names = procedureName.split('.');

    return names.length > 1
        ? names[1].toLowerCase()
        : names[0].toLowerCase();
}


//---------------- TRANSACTION ----------------------------------------------------

async function newTransaction(queries) {
    return new Promise((resolve, reject) => {
        this.connection.tx(t => {
            return t.batch(queries);
        })
            .then(data => resolve(data))
            .catch(error => reject(error));
    });
}

module.exports = (conn) => {
    return new Query(conn);
};
