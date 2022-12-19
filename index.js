const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");
require('dotenv').config()
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const firebaseConfig = {
    apiKey: process.env.FS_API_KEY,
    authDomain: process.env.FS_AUTH_DOMAIN,
    databaseURL: process.env.FS_DATABASE_URL,
    projectId: process.env.FS_PROJECT_ID,
};
firebase.initializeApp(firebaseConfig);

const BRANCH_PATH = `customers/${process.env.CUSTOMER_ID}/branches/${process.env.BRANCH_ID}`
const RESOURCE_PATH = `${BRANCH_PATH}/messegeQeue/msg`
console.log(BRANCH_PATH)
const ORDER_TYPE = "ORDER"
const RECEIPT_TYPE = "RECEIPT"

async function init() {
    console.log('init thermal printer.')
    try {
        await signIn()
        listenResource()

    } catch (error) {
        console.error(error)
    }
}

async function signIn() {
    try {
        let res = await firebase.auth().signInWithEmailAndPassword(
            process.env.CUSTOMER_EMAIL,
            process.env.CUSTOMER_PASSWORD
        );
        console.log('signed in successfully.', res.email)
    } catch (error) {
        console.error('Could not be signed in')
        return error
    }
}

function listenResource() {
    console.log('start listening resource');
    firebase.firestore()
        .doc(RESOURCE_PATH)
        // .orderBy('name', 'asc')
        .onSnapshot(docSnapshot => {
            let data = docSnapshot.data()
            print(data)
        }, err => {
            console.log(err);
        })
}

function print(data) {

    let printers = []
    data.SELECTED_PRINTERS.forEach(function (item) {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: item.TCP_ADDRESS,
            width: 40,
            characterSet: 'PC857_TURKISH',
        });
        console.log('created printer ', printer);
        printer.DETAILS = item
        console.log('printer with details', printer.DETAILS)
        printers.push(printer)
    })

    if (data.TYPE === RECEIPT_TYPE) {
        console.log('printing with new printer recipet')
        let printer = printers.find(function (p) {
            return p.DETAILS.roles.RECEIPT === true
        })

        if (!printer) {
            console.log('no printer')
            return
        }

        printer.println(replaceTrChars(data.OUTPUT));
        printer.cut();

        try {
            let execute = printer.execute();
            printer.beep(); // Sound internal beeper/buzzer (if available)
            console.log("Print done receipt, bar!i with new");
            // await printer.printImage(".touch.png"); // Print PNG image
        } catch (error) {
            console.log("Print failed with new:", error);
        }


    } else if (data.TYPE === ORDER_TYPE) {
        if (data.ORDERS.bar) {

            let printer = printers.find(function (p) {
                return p.DETAILS.roles.ORDER === true &&
                    p.DETAILS.sectionRef === 'bar'
            })

            if (!printer) {
                console.log("no printer available for bar")
                return
            }

            printer.println(replaceTrChars(data.ORDERS.bar));
            printer.cut();

            try {
                let execute = printer.execute();
                printer.beep(); // Sound internal beeper/buzzer (if available)
                console.log("Print done bar with new!");
                // await printer.printImage(".touch.png"); // Print PNG image
            } catch (error) {
                console.log("Print failed with new:", error);
            }
        }

        if (data.ORDERS.kitchen) {
            let printer = printers.find(function (p) {
                console.log(p.DETAILS.sectionRef)
                return p.DETAILS.roles.ORDER === true &&
                    p.DETAILS.sectionRef === 'mutfak'
            })

            if (!printer) {
                console.log("no printer available for kitchen")
                return
            }

            // printer.setTextDoubleHeight();                              // Set text to double height
            // printer.setTextDoubleWidth();

            console.log(data.ORDERS.kitchen)
            printer.println(replaceTrChars(data.ORDERS.kitchen));
            printer.cut();

            try {
                printer.beep(); // Sound internal beeper/buzzer (if available)
                let execute = printer.execute();
                console.log("Print done kitchen with new!");
                // await printer.printImage(".touch.png"); // Print PNG image
            } catch (error) {
                console.log("Print failed with new:", error);
            }
        }

    }

    return (data)
}


function replaceAll(string, search, replace) {
    if (string) {
        return string.split(search).join(replace);
    }
    return ""
}

const replaceTrChars = (temp) => {
    // const searchRegExp = /\s/g;
    // replaceWith = '-';

    let res = replaceAll(temp, 'İ', "i");
    // console.log(res)
    res = replaceAll(res, "ş", "s");
    res = replaceAll(res, "Ş", "S");
    res = replaceAll(res, "ğ", "g");
    // console.log(res)
    return res
}


init()